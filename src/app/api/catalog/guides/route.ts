import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog/guides?city=Hong Kong&q=mandarin
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get("city") || "").trim();
  const q = (searchParams.get("q") || "").trim();

  const guides = await prisma.guide.findMany({
    where: {
      ...(city ? { city } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { language: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(
    guides.map((g) => ({
      id: g.id,
      name: g.name,
      city: g.city,
      language: g.language,
      image: g.imageUrl,
      dailyRate: Number(g.dailyRate),
      currency: g.currency,
    })),
  );
}
