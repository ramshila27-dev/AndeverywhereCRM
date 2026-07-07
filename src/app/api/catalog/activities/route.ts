import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/catalog/activities?q=disney — activities with adult/child net rates.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();

  const activities = await prisma.activity.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { service: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    include: { rates: true },
  });

  return NextResponse.json(
    activities.map((a) => {
      const adult = a.rates.find((r) => r.paxType === "ADULT");
      const child = a.rates.find((r) => r.paxType === "CHILD");
      return {
        id: a.id,
        name: a.name,
        service: a.service,
        description: a.description,
        image: a.imageUrl,
        childAgeFrom: a.childAgeFrom,
        childAgeTo: a.childAgeTo,
        adultRate: adult?.netRate != null ? Number(adult.netRate) : null,
        childRate: child?.netRate != null ? Number(child.netRate) : null,
      };
    }),
  );
}
