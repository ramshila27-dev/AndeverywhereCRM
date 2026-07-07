import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceStay } from "@/lib/pricing";

export const runtime = "nodejs";

interface Body {
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
}

// POST /api/pricing/hotel — price a stay for a room across a date range.
// Resolves each night to its applicable season and returns the breakdown.
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { roomTypeId, checkIn, checkOut } = body;
  if (!roomTypeId || !checkIn || !checkOut) {
    return NextResponse.json(
      { error: "roomTypeId, checkIn and checkOut are required." },
      { status: 400 },
    );
  }
  if (new Date(checkOut) <= new Date(checkIn)) {
    return NextResponse.json(
      { error: "checkOut must be after checkIn." },
      { status: 400 },
    );
  }

  const room = await prisma.roomType.findUnique({
    where: { id: roomTypeId },
    include: {
      hotel: { select: { name: true, city: true, currency: true, imageUrl: true } },
      rates: { include: { season: true } },
    },
  });
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const pricing = priceStay(
    room.rates.map((r) => ({ netRate: r.netRate as unknown as number, season: r.season })),
    checkIn,
    checkOut,
  );

  return NextResponse.json({
    roomTypeId: room.id,
    hotel: room.hotel.name,
    city: room.hotel.city,
    currency: room.hotel.currency,
    image: room.hotel.imageUrl,
    room: `${room.name} (${room.maxPax}P, ${room.mealPlan})`,
    ...pricing,
  });
}
