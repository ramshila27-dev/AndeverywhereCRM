import QuoteBuilder from "@/components/QuoteBuilder";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: {
    queryId?: string;
    destination?: string;
    checkIn?: string;
    nights?: string;
    adults?: string;
    children?: string;
    title?: string;
  };
}) {
  await requirePermission("quotes");
  const nights = Math.max(1, Number(searchParams.nights) || 0);
  const checkIn = searchParams.checkIn;
  const initial = {
    queryId: searchParams.queryId,
    title: searchParams.title,
    city: searchParams.destination,
    checkIn,
    checkOut: checkIn && nights ? addDays(checkIn, nights) : undefined,
    adults: searchParams.adults ? Number(searchParams.adults) : undefined,
    children: searchParams.children ? Number(searchParams.children) : undefined,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Quote</h1>
        <p className="text-sm text-slate-500">
          {initial.queryId
            ? "Pricing a quote for the linked query."
            : "Build an itemized price from contracted hotel, transfer, and activity rates."}
        </p>
      </div>
      <QuoteBuilder initial={initial} />
    </div>
  );
}
