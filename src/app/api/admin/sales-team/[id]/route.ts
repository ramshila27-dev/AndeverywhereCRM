import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

// DELETE /api/admin/sales-team/:id — admin only. Marks the person inactive
// (soft delete) rather than removing the row, since past queries/quotes
// still reference their name as free text and shouldn't be affected.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user.roles)) return NextResponse.json({ error: "Admin only." }, { status: 403 });

  try {
    await prisma.salesPerson.update({ where: { id: params.id }, data: { active: false } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
