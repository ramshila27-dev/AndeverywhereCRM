import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "hotels", label: "Hotels" },
  { key: "transfers", label: "Transport Services" },
  { key: "activities", label: "Travel Activities" },
];

const th = "px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const td = "px-4 py-3 text-sm text-slate-700";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  await requirePermission("rates");
  const tab = TABS.some((t) => t.key === searchParams.tab) ? (searchParams.tab as string) : "hotels";

  let hotels: Awaited<ReturnType<typeof prisma.hotel.findMany>> & { _count?: unknown }[] = [] as never;
  let hotelRows: { id: string; name: string; city: string; starRating: number | null; imageUrl: string | null; rooms: number }[] = [];
  let transferRows: { id: string; fromLocation: string; toLocation: string; service: string; imageUrl: string | null }[] = [];
  let activityRows: { id: string; name: string; service: string; imageUrl: string | null }[] = [];
  let dbError = false;

  try {
    if (tab === "hotels") {
      const hs = await prisma.hotel.findMany({
        orderBy: [{ city: "asc" }, { name: "asc" }],
        select: { id: true, name: true, city: true, starRating: true, imageUrl: true, _count: { select: { roomTypes: true } } },
      });
      hotelRows = hs.map((h) => ({ ...h, rooms: h._count.roomTypes }));
    } else if (tab === "transfers") {
      transferRows = await prisma.transfer.findMany({
        orderBy: [{ fromLocation: "asc" }, { toLocation: "asc" }],
        select: { id: true, fromLocation: true, toLocation: true, service: true, imageUrl: true },
      });
    } else {
      activityRows = await prisma.activity.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, service: true, imageUrl: true },
      });
    }
  } catch {
    dbError = true;
  }
  void hotels;

  const count = tab === "hotels" ? hotelRows.length : tab === "transfers" ? transferRows.length : activityRows.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Rates &amp; Inventory</h1>
        <Link
          href={`/catalog/${tab}/upload`}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600"
        >
          ⤒ Upload Prices (XLS)
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/catalog?tab=${t.key}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {dbError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Could not reach the database.
        </div>
      )}

      <p className="text-sm text-slate-500">Showing {count} item(s)</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {tab === "hotels" && (
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Location</th>
                <th className={th}>Star</th>
                <th className={th}>Room Types</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hotelRows.length === 0 && <Empty span={4} />}
              {hotelRows.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50">
                  <td className={`${td} font-medium text-slate-800`}>{h.name}</td>
                  <td className={td}>{h.city}</td>
                  <td className={td}>{h.starRating ? `${h.starRating}★` : "—"}</td>
                  <td className={td}>{h.rooms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "transfers" && (
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={th}>From</th>
                <th className={th}>To</th>
                <th className={th}>Service</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transferRows.length === 0 && <Empty span={3} />}
              {transferRows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className={`${td} font-medium text-slate-800`}>{t.fromLocation}</td>
                  <td className={td}>{t.toLocation}</td>
                  <td className={`${td} text-slate-500`}>{t.service}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "activities" && (
          <table className="w-full min-w-[560px]">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className={th}>Activity Name</th>
                <th className={th}>Service / Ticket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activityRows.length === 0 && <Empty span={2} />}
              {activityRows.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className={`${td} font-medium text-slate-800`}>{a.name}</td>
                  <td className={`${td} text-slate-500`}>{a.service}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Use “Upload Prices (XLS)” to import or refresh rates for hotels, transport, and activities.
      </p>
    </div>
  );
}

function Empty({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-12 text-center text-sm text-slate-400">
        No items yet. Use “Upload Prices (XLS)” to import rates.
      </td>
    </tr>
  );
}
