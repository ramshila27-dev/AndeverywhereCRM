import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUS_OPTIONS } from "@/lib/types";
import type { ItineraryDay } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// GET /api/itineraries/:id
export async function GET(_req: Request, { params }: Params) {
  const itinerary = await prisma.itinerary.findUnique({
    where: { id: params.id },
  });
  if (!itinerary) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json(itinerary);
}

interface PatchBody {
  title?: string;
  status?: string;
  summary?: string;
  notes?: string;
  days?: ItineraryDay[];
}

// PATCH /api/itineraries/:id — update editable fields.
export async function PATCH(req: Request, { params }: Params) {
  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    body.status !== undefined &&
    !STATUS_OPTIONS.includes(body.status as (typeof STATUS_OPTIONS)[number])
  ) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const data: Prisma.ItineraryUpdateInput = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.status !== undefined) data.status = body.status;
  if (body.summary !== undefined) data.summary = body.summary;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.days !== undefined)
    data.days = body.days as unknown as Prisma.InputJsonValue;

  try {
    const updated = await prisma.itinerary.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}

// DELETE /api/itineraries/:id
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await prisma.itinerary.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
