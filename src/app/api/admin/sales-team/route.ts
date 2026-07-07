import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/sales-team — list of active users who have the Sales
// Person role, for the New Query "Sales Team" dropdown. There's no separate
// admin page for this: add/remove someone from the sales team by giving or
// removing the "Sales Person" role on their user account under
// Admin -> Users.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const people = await prisma.user.findMany({
    where: { roles: { has: "SALES_PERSON" }, status: { not: "SUSPENDED" } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return NextResponse.json(people);
}
