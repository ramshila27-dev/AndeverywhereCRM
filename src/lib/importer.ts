import ExcelJS from "exceljs";
import type { Worksheet } from "exceljs";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Server-side parser for the supplier rate sheets (same formats the CLI
// importer handles), used by the in-app upload. Unlike the CLI (which wipes the
// whole catalog), these upsert per item and preserve each entity's imageUrl so
// re-uploading rates never erases the photos used on the PDF.

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function text(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if (typeof v.text === "string") return v.text;
    if (typeof v.result !== "undefined") return String(v.result ?? "");
    if (Array.isArray(v.richText)) return v.richText.map((t: { text: string }) => t.text).join("");
  }
  return String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRate(v: any): number | null {
  if (v == null || v === "") return null;
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "object" && typeof v.result === "number") n = v.result;
  else n = Number(String(v).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return null;
  if (n <= 1) return null; // sentinel / closed
  return n;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInt0(v: any): number | null {
  const n = Number(text(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function parseDate(part: string): Date | null {
  const m = part.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (mon == null) return null;
  return new Date(Date.UTC(Number(m[3]), mon, Number(m[1])));
}

function parseBand(raw: unknown): { start: Date | null; end: Date | null; daysOfWeek: string | null; raw: string } {
  const clean = text(raw).trim();
  let daysOfWeek: string | null = null;
  let body = clean;
  const dow = body.match(/\(([^)]*)\)\s*$/);
  if (dow) {
    daysOfWeek = dow[1].trim();
    body = body.slice(0, dow.index).trim();
  }
  const parts = body.split(/\s*-\s*/);
  return { start: parseDate(parts[0] || ""), end: parseDate(parts[1] || parts[0] || ""), daysOfWeek, raw: clean };
}

function parseTitle(raw: unknown): { name: string; city: string; star: number | null } {
  const parts = text(raw).split("|").map((s) => s.trim()).filter(Boolean);
  const name = parts[0] || "Unknown Hotel";
  const cityRaw = (parts[1] || "").toLowerCase();
  const city = cityRaw.includes("macau") ? "Macau" : "Hong Kong";
  const starMatch = (parts[2] || "").match(/(\d+)/);
  return { name, city, star: starMatch ? Number(starMatch[1]) : null };
}

function extraKind(label: string): "EXTRA_BED_ADULT" | "EXTRA_BED_CHILD" | "CHILD_NO_BED" {
  const l = label.toLowerCase();
  if (l.includes("without bed") || l.includes("cnb")) return "CHILD_NO_BED";
  if (l.includes("child")) return "EXTRA_BED_CHILD";
  return "EXTRA_BED_ADULT";
}

function maxPaxFromName(name: string): number | null {
  const nums = (text(name).match(/\d+/g) || []).map(Number);
  return nums.length ? Math.max(...nums) : null;
}

async function chunked<T>(model: { createMany: (a: { data: T[] }) => Promise<unknown> }, rows: T[], chunk = 1000) {
  for (let i = 0; i < rows.length; i += chunk) await model.createMany({ data: rows.slice(i, i + chunk) });
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buffer as any);
  return wb;
}

// -------------------------------- hotels ----------------------------------

export async function importHotels(buffer: Buffer) {
  const wb = await loadWorkbook(buffer);
  let hotels = 0, rooms = 0, roomRates = 0, extras = 0;

  for (const ws of wb.worksheets) {
    const title = ws.getCell(1, 1).value;
    const { name, city, star } = parseTitle(title);

    let hdr: number | null = null;
    for (let r = 1; r <= ws.rowCount; r++) {
      if (text(ws.getCell(r, 1).value).trim() === "ROOM CATEGORY") { hdr = r; break; }
    }
    if (!hdr) continue;

    const bandByCode = new Map<string, unknown>();
    for (let r = 1; r < hdr; r++) {
      const a = text(ws.getCell(r, 1).value).trim();
      if (/^Sea?son\s+\d+/i.test(a)) bandByCode.set(a, ws.getCell(r, 2).value);
    }
    const seasonCols: { col: number; code: string }[] = [];
    for (let c = 5; c <= ws.columnCount; c++) {
      const code = text(ws.getCell(hdr, c).value).trim();
      if (code) seasonCols.push({ col: c, code });
    }

    // upsert hotel (preserve imageUrl)
    const hotel = await prisma.hotel.upsert({
      where: { name_city: { name, city } },
      update: { starRating: star, rawTitle: text(title) },
      create: { name, city, starRating: star, rawTitle: text(title) },
    });
    hotels++;

    // wipe this hotel's rate children only
    await prisma.hotelSeason.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.roomType.deleteMany({ where: { hotelId: hotel.id } });
    await prisma.hotelExtra.deleteMany({ where: { hotelId: hotel.id } });

    const seasonId = new Map<string, string>();
    for (const { code } of seasonCols) {
      if (seasonId.has(code)) continue;
      const b = parseBand(bandByCode.get(code) ?? code);
      if (!b.start || !b.end) continue;
      const s = await prisma.hotelSeason.create({
        data: { hotelId: hotel.id, code, rawBand: b.raw, startDate: b.start, endDate: b.end, daysOfWeek: b.daysOfWeek },
      });
      seasonId.set(code, s.id);
    }

    const roomRateRows: Prisma.RoomRateCreateManyInput[] = [];
    const seenRoom = new Set<string>();
    let r = hdr + 1;
    for (; r <= ws.rowCount; r++) {
      const a = text(ws.getCell(r, 1).value).trim();
      if (a.toUpperCase() === "EXTRAS") break;
      if (!a) continue;
      const roomName = text(ws.getCell(r, 2).value).trim() || a;
      const mealPlan = text(ws.getCell(r, 3).value).trim() || "RO";
      const maxPax = parseInt0(ws.getCell(r, 4).value) ?? 2;
      const key = `${roomName}|${mealPlan}|${maxPax}`;
      if (seenRoom.has(key)) continue;
      seenRoom.add(key);
      const room = await prisma.roomType.create({ data: { hotelId: hotel.id, category: a, name: roomName, mealPlan, maxPax } });
      rooms++;
      for (const { col, code } of seasonCols) {
        const sid = seasonId.get(code);
        if (!sid) continue;
        roomRateRows.push({ roomTypeId: room.id, seasonId: sid, netRate: parseRate(ws.getCell(r, col).value) });
      }
    }
    await chunked(prisma.roomRate, roomRateRows);
    roomRates += roomRateRows.length;

    const extraRateRows: Prisma.HotelExtraRateCreateManyInput[] = [];
    const seenKind = new Set<string>();
    for (r = r + 1; r <= ws.rowCount; r++) {
      const label = text(ws.getCell(r, 1).value).trim();
      if (!label) continue;
      const kind = extraKind(label);
      if (seenKind.has(kind)) continue;
      seenKind.add(kind);
      const extra = await prisma.hotelExtra.create({ data: { hotelId: hotel.id, kind, label } });
      extras++;
      for (const { col, code } of seasonCols) {
        const sid = seasonId.get(code);
        if (!sid) continue;
        extraRateRows.push({ extraId: extra.id, seasonId: sid, netRate: parseRate(ws.getCell(r, col).value) });
      }
    }
    await chunked(prisma.hotelExtraRate, extraRateRows);
  }

  return { hotels, rooms, roomRates, extras };
}

// ------------------------------- transfers --------------------------------

function findTransportSheet(wb: ExcelJS.Workbook): Worksheet | undefined {
  return wb.worksheets.find((w) => w.name.trim().toLowerCase().startsWith("transport"));
}

export async function importTransfers(buffer: Buffer) {
  const wb = await loadWorkbook(buffer);
  const ws = findTransportSheet(wb);
  if (!ws) throw new Error('No "Transport" sheet found in the uploaded file.');

  const b = parseBand(ws.getCell(2, 9).value);
  const season = await prisma.transferSeason.upsert({
    where: { code: "Season 1" },
    update: { rawBand: b.raw, startDate: b.start!, endDate: b.end! },
    create: { code: "Season 1", rawBand: b.raw, startDate: b.start!, endDate: b.end! },
  });

  const vehicleCols: { col: number; vehicleTypeId: string }[] = [];
  for (let c = 9; c <= ws.columnCount; c++) {
    const nm = text(ws.getCell(4, c).value).trim();
    if (nm) {
      const vt = await prisma.vehicleType.upsert({ where: { name: nm }, update: {}, create: { name: nm, maxPax: maxPaxFromName(nm) } });
      vehicleCols.push({ col: c, vehicleTypeId: vt.id });
    }
  }

  let transfers = 0, rates = 0;
  const seen = new Set<string>();
  for (let r = 5; r <= ws.rowCount; r++) {
    const from = text(ws.getCell(r, 2).value).trim();
    const to = text(ws.getCell(r, 3).value).trim();
    if (!from || !to) continue;
    const service = text(ws.getCell(r, 4).value).trim() || "Transfer";
    const k = `${from}|${to}|${service}`;
    if (seen.has(k)) continue;
    seen.add(k);

    const transfer = await prisma.transfer.upsert({
      where: { fromLocation_toLocation_service: { fromLocation: from, toLocation: to, service } },
      update: {
        distance: text(ws.getCell(r, 5).value).trim() || null,
        startTime: text(ws.getCell(r, 6).value).trim() || null,
        durationMins: parseInt0(ws.getCell(r, 7).value),
        daySchedule: text(ws.getCell(r, 8).value).trim() || null,
      },
      create: {
        fromLocation: from, toLocation: to, service,
        distance: text(ws.getCell(r, 5).value).trim() || null,
        startTime: text(ws.getCell(r, 6).value).trim() || null,
        durationMins: parseInt0(ws.getCell(r, 7).value),
        daySchedule: text(ws.getCell(r, 8).value).trim() || null,
      },
    });
    transfers++;

    await prisma.transferRate.deleteMany({ where: { transferId: transfer.id } });
    const rateRows: Prisma.TransferRateCreateManyInput[] = [];
    for (const { col, vehicleTypeId } of vehicleCols) {
      const raw = ws.getCell(r, col).value;
      if (raw == null || raw === "") continue;
      rateRows.push({ transferId: transfer.id, seasonId: season.id, vehicleTypeId, netRate: parseRate(raw) });
    }
    await chunked(prisma.transferRate, rateRows);
    rates += rateRows.length;
  }
  return { transfers, vehicleTypes: vehicleCols.length, transferRates: rates };
}

// ------------------------------ activities --------------------------------

function childAges(header: unknown): { from: number | null; to: number | null } {
  const m = text(header).match(/\((\d+)\s*-\s*(\d+)\)/);
  return m ? { from: Number(m[1]), to: Number(m[2]) } : { from: null, to: null };
}

export async function importActivities(buffer: Buffer) {
  const wb = await loadWorkbook(buffer);
  const sheets = wb.worksheets.filter((w) => w.name.trim().toLowerCase().startsWith("activity"));
  if (!sheets.length) throw new Error('No "Activity" sheet found in the uploaded file.');

  const b = parseBand(sheets[0].getCell(2, 8).value);
  const season = await prisma.activitySeason.upsert({
    where: { code: "Season 1" },
    update: { rawBand: b.raw, startDate: b.start!, endDate: b.end! },
    create: { code: "Season 1", rawBand: b.raw, startDate: b.start!, endDate: b.end! },
  });

  let activities = 0, rates = 0;
  const seen = new Set<string>();
  for (const ws of sheets) {
    const ages = childAges(ws.getCell(4, 9).value);
    for (let r = 6; r <= ws.rowCount; r++) {
      const name = text(ws.getCell(r, 1).value).trim();
      if (!name) continue;
      const service = text(ws.getCell(r, 2).value).trim() || "Activity";
      const k = `${name}|${service}`;
      if (seen.has(k)) continue;
      seen.add(k);

      const activity = await prisma.activity.upsert({
        where: { name_service: { name, service } },
        update: {
          description: text(ws.getCell(r, 3).value).trim() || null,
          openTime: text(ws.getCell(r, 4).value).trim() || null,
          closeTime: text(ws.getCell(r, 5).value).trim() || null,
          durationMins: parseInt0(ws.getCell(r, 6).value),
          slots: text(ws.getCell(r, 7).value).trim() || null,
          childAgeFrom: ages.from, childAgeTo: ages.to,
        },
        create: {
          name, service,
          description: text(ws.getCell(r, 3).value).trim() || null,
          openTime: text(ws.getCell(r, 4).value).trim() || null,
          closeTime: text(ws.getCell(r, 5).value).trim() || null,
          durationMins: parseInt0(ws.getCell(r, 6).value),
          slots: text(ws.getCell(r, 7).value).trim() || null,
          childAgeFrom: ages.from, childAgeTo: ages.to,
        },
      });
      activities++;

      await prisma.activityRate.deleteMany({ where: { activityId: activity.id } });
      const rateRows: Prisma.ActivityRateCreateManyInput[] = [];
      const adult = ws.getCell(r, 8).value;
      const child = ws.getCell(r, 9).value;
      if (adult != null && adult !== "") rateRows.push({ activityId: activity.id, seasonId: season.id, paxType: "ADULT", netRate: parseRate(adult) });
      if (child != null && child !== "") rateRows.push({ activityId: activity.id, seasonId: season.id, paxType: "CHILD", netRate: parseRate(child) });
      await chunked(prisma.activityRate, rateRows);
      rates += rateRows.length;
    }
  }
  return { activities, activityRates: rates };
}
