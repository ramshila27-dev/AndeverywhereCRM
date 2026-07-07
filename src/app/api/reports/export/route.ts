import { getReport } from "@/lib/reports";

export const runtime = "nodejs";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

// GET /api/reports/export?month=YYYY-MM&tab=trips|team|destinations|sources
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || undefined;
  const tab = searchParams.get("tab") || "trips";

  const data = await getReport(month);
  let headers: string[] = [];
  let rows: (string | number)[][] = [];

  if (tab === "team") {
    headers = ["Name", "Leads", "Quotes", "Conversions", "Conv %", "Drops", "Pax", "Revenue"];
    rows = data.team.map((r) => [
      r.name, r.leads, r.quotes, r.conversions, r.convPct.toFixed(2), r.drops, r.pax, Math.round(r.revenue),
    ]);
  } else if (tab === "destinations" || tab === "sources") {
    const g = tab === "destinations" ? data.destinations : data.sources;
    headers = [tab === "destinations" ? "Destination" : "Trip Source", "Leads", "Quotes", "Conversions", "Conv %", "Pax", "Revenue"];
    rows = g.map((r) => [r.name, r.leads, r.quotes, r.conversions, r.convPct.toFixed(2), r.pax, Math.round(r.revenue)]);
  } else {
    headers = ["Ref", "Guest", "Details", "Sales Person", "Date", `Amount (${data.currency})`, "Status"];
    rows = data.trips.map((r) => [r.ref, r.guest, r.basic, r.salesPerson, r.date, Math.round(r.amount), r.status]);
  }

  const csv = toCsv(headers, rows);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sales-report-${data.monthKey}-${tab}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
