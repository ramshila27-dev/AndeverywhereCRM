import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog/hotels/:id/rooms — room types for a hotel.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const rooms = await prisma.roomType.findMany({
    where: { hotelId: params.id },
    orderBy: { name: "asc" },
    select: { id: true, category: true, name: true, mealPlan: true, maxPax: true },
  });
  return NextResponse.json(rooms);
}
