import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog/other-services?city=Hong Kong&q=sim
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get("city") || "").trim();
  const q = (searchParams.get("q") || "").trim();

  const services = await prisma.otherService.findMany({
    where: {
      ...(city ? { city } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    services.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      description: s.description,
      unitLabel: s.unitLabel,
      rate: Number(s.rate),
      image: s.imageUrl,
      currency: s.currency,
    })),
  );
}
