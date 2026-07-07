// Importer for the supplier contracting-rate sheets into the Prisma catalog.
//
// Usage:
//   node scripts/import-rates.mjs <hotels.xlsx> <land.xlsx>
//
// Re-running is safe: the catalog tables are wiped and rebuilt from the sheets.
// It does NOT touch the Itinerary table.

import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// -------------------------------- helpers ---------------------------------

function text(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    // exceljs rich text / hyperlink / formula result
    if (typeof v.text === "string") return v.text;
    if (typeof v.result !== "undefined") return String(v.result ?? "");
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
  }
  return String(v);
}

// A rate cell. The sheets use 1 (and blank/0) as a "not available" sentinel.
function parseRate(v) {
  if (v == null || v === "") return null;
  let n;
  if (typeof v === "number") n = v;
  else if (typeof v === "object" && typeof v.result === "number") n = v.result;
  else n = Number(String(v).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n <= 1) return null; // sentinel / closed
  return n;
}

function parseInt0(v) {
  const n = Number(text(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function parseDate(part) {
  const m = part.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (mon == null) return null;
  return new Date(Date.UTC(Number(m[3]), mon, Number(m[1])));
}

// "01 Jul 2026 - 31 Aug 2026 (Sun,Mon,Tue,Wed,Thu)" -> {start,end,daysOfWeek,raw}
function parseBand(raw) {
  const clean = text(raw).trim();
  let daysOfWeek = null;
  let body = clean;
  const dow = body.match(/\(([^)]*)\)\s*$/);
  if (dow) {
    daysOfWeek = dow[1].trim();
    body = body.slice(0, dow.index).trim();
  }
  const parts = body.split(/\s*-\s*/);
  const start = parseDate(parts[0] || "");
  const end = parseDate(parts[1] || parts[0] || "");
  return { start, end, daysOfWeek, raw: clean };
}

// "PARK HOTEL | Hong Kong | 4-STAR" -> {name, city, star}
function parseTitle(raw) {
  const parts = text(raw).split("|").map((s) => s.trim()).filter(Boolean);
  const name = parts[0] || "Unknown Hotel";
  const cityRaw = (parts[1] || "").toLowerCase();
  const city = cityRaw.includes("macau") ? "Macau" : "Hong Kong";
  const starMatch = (parts[2] || "").match(/(\d+)/);
  const star = starMatch ? Number(starMatch[1]) : null;
  return { name, city, star };
}

function extraKind(label) {
  const l = label.toLowerCase();
  if (l.includes("without bed") || l.includes("cnb")) return "CHILD_NO_BED";
  if (l.includes("child")) return "EXTRA_BED_CHILD";
  return "EXTRA_BED_ADULT";
}

function maxPaxFromName(name) {
  const nums = (text(name).match(/\d+/g) || []).map(Number);
  return nums.length ? Math.max(...nums) : null;
}

async function createManyChunked(model, rows, chunk = 1000) {
  for (let i = 0; i < rows.length; i += chunk) {
    await model.createMany({ data: rows.slice(i, i + chunk) });
  }
}

// -------------------------------- hotels ----------------------------------

async function importHotels(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  let hotels = 0, rooms = 0, roomRates = 0, extras = 0, extraRates = 0;

  for (const ws of wb.worksheets) {
    const title = ws.getCell(1, 1).value;
    const { name, city, star } = parseTitle(title);

    // header row: column A === "ROOM CATEGORY"
    let hdr = null;
    for (let r = 1; r <= ws.rowCount; r++) {
      if (text(ws.getCell(r, 1).value).trim() === "ROOM CATEGORY") { hdr = r; break; }
    }
    if (!hdr) { console.warn(`  skip "${ws.name}": no rate grid`); continue; }

    // season-reference table: rows where col A is "Season N" / "Seaon N"
    const bandByCode = new Map();
    for (let r = 1; r < hdr; r++) {
      const a = text(ws.getCell(r, 1).value).trim();
      if (/^Sea?son\s+\d+/i.test(a)) bandByCode.set(a, ws.getCell(r, 2).value);
    }

    // season columns from the header row (col 5 onward)
    const seasonCols = [];
    for (let c = 5; c <= ws.columnCount; c++) {
      const code = text(ws.getCell(hdr, c).value).trim();
      if (code) seasonCols.push({ col: c, code });
    }

    const hotel = await prisma.hotel.create({
      data: { name, city, starRating: star, rawTitle: text(title) },
    });
    hotels++;

    // seasons
    const seasonIdByCode = new Map();
    for (const { code } of seasonCols) {
      if (seasonIdByCode.has(code)) continue;
      const b = parseBand(bandByCode.get(code) ?? code);
      if (!b.start || !b.end) continue;
      const s = await prisma.hotelSeason.create({
        data: {
          hotelId: hotel.id, code, rawBand: b.raw,
          startDate: b.start, endDate: b.end, daysOfWeek: b.daysOfWeek,
        },
      });
      seasonIdByCode.set(code, s.id);
    }

    // room rows until "EXTRAS"
    const roomRateRows = [];
    const seenRoom = new Set();
    let r = hdr + 1;
    for (; r <= ws.rowCount; r++) {
      const a = text(ws.getCell(r, 1).value).trim();
      if (a.toUpperCase() === "EXTRAS") break;
      if (!a) continue;
      const roomName = text(ws.getCell(r, 2).value).trim() || a;
      const mealPlan = text(ws.getCell(r, 3).value).trim() || "RO";
      const maxPax = parseInt0(ws.getCell(r, 4).value) ?? 2;
      const roomKey = `${roomName}|${mealPlan}|${maxPax}`;
      if (seenRoom.has(roomKey)) continue; // skip exact-duplicate room rows
      seenRoom.add(roomKey);
      const room = await prisma.roomType.create({
        data: { hotelId: hotel.id, category: a, name: roomName, mealPlan, maxPax },
      });
      rooms++;
      for (const { col, code } of seasonCols) {
        const seasonId = seasonIdByCode.get(code);
        if (!seasonId) continue;
        roomRateRows.push({
          roomTypeId: room.id, seasonId,
          netRate: parseRate(ws.getCell(r, col).value),
        });
      }
    }
    await createManyChunked(prisma.roomRate, roomRateRows);
    roomRates += roomRateRows.length;

    // extras (rows after "EXTRAS")
    const extraRateRows = [];
    const seenKind = new Set();
    for (r = r + 1; r <= ws.rowCount; r++) {
      const label = text(ws.getCell(r, 1).value).trim();
      if (!label) continue;
      const kind = extraKind(label);
      if (seenKind.has(kind)) continue; // one row per kind
      seenKind.add(kind);
      const extra = await prisma.hotelExtra.create({
        data: { hotelId: hotel.id, kind, label },
      });
      extras++;
      for (const { col, code } of seasonCols) {
        const seasonId = seasonIdByCode.get(code);
        if (!seasonId) continue;
        extraRateRows.push({
          extraId: extra.id, seasonId,
          netRate: parseRate(ws.getCell(r, col).value),
        });
      }
    }
    await createManyChunked(prisma.hotelExtraRate, extraRateRows);
    extraRates += extraRateRows.length;
  }

  console.log(
    `  hotels=${hotels} roomTypes=${rooms} roomRates=${roomRates} extras=${extras} extraRates=${extraRates}`,
  );
}

// ------------------------------- transfers --------------------------------

async function importTransfers(ws) {
  // season band from row 2, first season column (col 9 / I)
  const b = parseBand(ws.getCell(2, 9).value);
  const season = await prisma.transferSeason.create({
    data: { code: "Season 1", rawBand: b.raw, startDate: b.start, endDate: b.end },
  });

  // vehicle-type columns from row 4 (col 9 onward)
  const vehicleCols = [];
  for (let c = 9; c <= ws.columnCount; c++) {
    const nm = text(ws.getCell(4, c).value).trim();
    if (nm) {
      const vt = await prisma.vehicleType.upsert({
        where: { name: nm },
        update: {},
        create: { name: nm, maxPax: maxPaxFromName(nm) },
      });
      vehicleCols.push({ col: c, vehicleTypeId: vt.id });
    }
  }

  let transfers = 0, rates = 0;
  const seen = new Set();
  for (let r = 5; r <= ws.rowCount; r++) {
    const from = text(ws.getCell(r, 2).value).trim();
    const to = text(ws.getCell(r, 3).value).trim();
    if (!from || !to) continue;
    const service = text(ws.getCell(r, 4).value).trim() || "Transfer";
    const key = `${from}|${to}|${service}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const transfer = await prisma.transfer.create({
      data: {
        fromLocation: from,
        toLocation: to,
        service,
        distance: text(ws.getCell(r, 5).value).trim() || null,
        startTime: text(ws.getCell(r, 6).value).trim() || null,
        durationMins: parseInt0(ws.getCell(r, 7).value),
        daySchedule: text(ws.getCell(r, 8).value).trim() || null,
      },
    });
    transfers++;

    const rateRows = [];
    for (const { col, vehicleTypeId } of vehicleCols) {
      const raw = ws.getCell(r, col).value;
      if (raw == null || raw === "") continue;
      rateRows.push({
        transferId: transfer.id, seasonId: season.id, vehicleTypeId,
        netRate: parseRate(raw),
      });
    }
    await createManyChunked(prisma.transferRate, rateRows);
    rates += rateRows.length;
  }
  console.log(`  transfers=${transfers} vehicleTypes=${vehicleCols.length} transferRates=${rates}`);
}

// ------------------------------ activities --------------------------------

function childAges(header) {
  const m = text(header).match(/\((\d+)\s*-\s*(\d+)\)/);
  return m ? { from: Number(m[1]), to: Number(m[2]) } : { from: null, to: null };
}

async function importActivities(sheets) {
  // single shared season taken from the first sheet
  const first = sheets[0];
  const b = parseBand(first.getCell(2, 8).value);
  const season = await prisma.activitySeason.create({
    data: { code: "Season 1", rawBand: b.raw, startDate: b.start, endDate: b.end },
  });

  let activities = 0, rates = 0;
  const seen = new Set();
  for (const ws of sheets) {
    const ages = childAges(ws.getCell(4, 9).value); // "Child (3-11)"
    for (let r = 6; r <= ws.rowCount; r++) {
      const name = text(ws.getCell(r, 1).value).trim();
      if (!name) continue;
      const service = text(ws.getCell(r, 2).value).trim() || "Activity";
      const key = `${name}|${service}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const activity = await prisma.activity.create({
        data: {
          name,
          service,
          description: text(ws.getCell(r, 3).value).trim() || null,
          openTime: text(ws.getCell(r, 4).value).trim() || null,
          closeTime: text(ws.getCell(r, 5).value).trim() || null,
          durationMins: parseInt0(ws.getCell(r, 6).value),
          slots: text(ws.getCell(r, 7).value).trim() || null,
          childAgeFrom: ages.from,
          childAgeTo: ages.to,
        },
      });
      activities++;

      const adult = parseRate(ws.getCell(r, 8).value);
      const child = parseRate(ws.getCell(r, 9).value);
      const rateRows = [];
      if (ws.getCell(r, 8).value != null && ws.getCell(r, 8).value !== "")
        rateRows.push({ activityId: activity.id, seasonId: season.id, paxType: "ADULT", netRate: adult });
      if (ws.getCell(r, 9).value != null && ws.getCell(r, 9).value !== "")
        rateRows.push({ activityId: activity.id, seasonId: season.id, paxType: "CHILD", netRate: child });
      await createManyChunked(prisma.activityRate, rateRows);
      rates += rateRows.length;
    }
  }
  console.log(`  activities=${activities} activityRates=${rates}`);
}

// --------------------------------- main -----------------------------------

async function wipe() {
  // child → parent order
  await prisma.roomRate.deleteMany();
  await prisma.hotelExtraRate.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.hotelExtra.deleteMany();
  await prisma.hotelSeason.deleteMany();
  await prisma.hotel.deleteMany();

  await prisma.transferRate.deleteMany();
  await prisma.transfer.deleteMany();
  await prisma.transferSeason.deleteMany();
  await prisma.vehicleType.deleteMany();

  await prisma.activityRate.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.activitySeason.deleteMany();
}

async function main() {
  const [hotelsFile, landFile] = process.argv.slice(2);
  if (!hotelsFile || !landFile) {
    console.error("Usage: node scripts/import-rates.mjs <hotels.xlsx> <land.xlsx>");
    process.exit(1);
  }

  console.log("Wiping existing catalog…");
  await wipe();

  console.log("Importing hotels…");
  await importHotels(hotelsFile);

  console.log("Importing transfers & activities…");
  const land = new ExcelJS.Workbook();
  await land.xlsx.readFile(landFile);
  const transport = land.worksheets.find((w) => w.name.trim().toLowerCase() === "transport");
  const activitySheets = land.worksheets.filter((w) => w.name.trim().toLowerCase().startsWith("activity"));
  if (transport) await importTransfers(transport);
  if (activitySheets.length) await importActivities(activitySheets);

  console.log("Done.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
