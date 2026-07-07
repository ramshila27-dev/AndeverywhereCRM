import { NextResponse } from "next/server";
import { generateItinerary } from "@/lib/ai";
import type { TripInput } from "@/lib/types";

export const runtime = "nodejs";
// Generation can take a while; allow a generous timeout on platforms that honor it.
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: TripInput;
  try {
    body = (await req.json()) as TripInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.destination || !body.startDate || !body.endDate) {
    return NextResponse.json(
      { error: "destination, startDate and endDate are required." },
      { status: 400 },
    );
  }

  if (new Date(body.endDate) < new Date(body.startDate)) {
    return NextResponse.json(
      { error: "endDate must be on or after startDate." },
      { status: 400 },
    );
  }

  try {
    const itinerary = await generateItinerary({
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      travelers: Number(body.travelers) || 1,
      budget: body.budget,
      interests: Array.isArray(body.interests) ? body.interests : [],
      pace: body.pace || "balanced",
      notes: body.notes,
    });
    return NextResponse.json(itinerary);
  } catch (err) {
    console.error("Itinerary generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate itinerary. Please try again." },
      { status: 502 },
    );
  }
}
