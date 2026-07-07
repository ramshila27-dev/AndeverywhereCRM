import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog/transfers?q=airport — transfers with their per-vehicle rates.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const transfers = await prisma.transfer.findMany({
    where: q
      ? {
          OR: [
            { fromLocation: { contains: q, mode: "insensitive" } },
            { toLocation: { contains: q, mode: "insensitive" } },
            { service: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: [{ fromLocation: "asc" }, { toLocation: "asc" }],
    include: { rates: { include: { vehicleType: true } } },
  });

  return NextResponse.json(
    transfers.map((t) => ({
      id: t.id,
      fromLocation: t.fromLocation,
      toLocation: t.toLocation,
      service: t.service,
      durationMins: t.durationMins,
      daySchedule: t.daySchedule,
      image: t.imageUrl,
      // only vehicle options that actually have a rate
      vehicles: t.rates
        .filter((r) => r.netRate != null)
        .map((r) => ({
          vehicleTypeId: r.vehicleTypeId,
          name: r.vehicleType.name,
          maxPax: r.vehicleType.maxPax,
          netRate: Number(r.netRate),
        }))
        .sort((a, b) => a.netRate - b.netRate),
    })),
  );
}
