import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog/cities — distinct destination cities present in the catalog,
// with hotel counts. Drives the destination selector so new destinations show
// up automatically as their inventory is imported.
export async function GET() {
  const grouped = await prisma.hotel.groupBy({
    by: ["city"],
    _count: { _all: true },
    orderBy: { city: "asc" },
  });
  return NextResponse.json(
    grouped.map((g) => ({ city: g.city, hotels: g._count._all })),
  );
}
