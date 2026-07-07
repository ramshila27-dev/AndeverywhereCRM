import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { GeneratedItinerary, TripInput } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

// GET /api/itineraries — list saved itineraries (most recent first).
export async function GET() {
  const itineraries = await prisma.itinerary.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(itineraries);
}

interface CreateBody {
  input: TripInput;
  itinerary: GeneratedItinerary;
}

// POST /api/itineraries — persist a generated itinerary.
export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { input, itinerary } = body;
  if (!input || !itinerary) {
    return NextResponse.json(
      { error: "Both input and itinerary are required." },
      { status: 400 },
    );
  }

  const created = await prisma.itinerary.create({
    data: {
      title: itinerary.title || `Trip to ${input.destination}`,
      destination: input.destination,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      travelers: Number(input.travelers) || 1,
      budget: input.budget || null,
      interests: Array.isArray(input.interests) ? input.interests : [],
      pace: input.pace || "balanced",
      notes: input.notes || null,
      summary: itinerary.summary || null,
      days: itinerary.days as unknown as Prisma.InputJsonValue,
      tips: Array.isArray(itinerary.tips) ? itinerary.tips : [],
    },
  });

  return NextResponse.json(created, { status: 201 });
}
