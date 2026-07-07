import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog/hotels?city=Hong%20Kong — hotels, optionally filtered by city.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = searchParams.get("city");

  const hotels = await prisma.hotel.findMany({
    where: city ? { city } : undefined,
    orderBy: [{ city: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      city: true,
      starRating: true,
      currency: true,
      _count: { select: { roomTypes: true } },
    },
  });

  return NextResponse.json(
    hotels.map((h) => ({
      id: h.id,
      name: h.name,
      city: h.city,
      starRating: h.starRating,
      currency: h.currency,
      roomTypes: h._count.roomTypes,
    })),
  );
}
