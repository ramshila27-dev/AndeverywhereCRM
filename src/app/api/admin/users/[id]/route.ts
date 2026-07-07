import { NextResponse } from "next/server";
import { type Role, type UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { isAdmin, ALL_ROLES, GRANTABLE_FEATURES } from "@/lib/permissions";

export const runtime = "nodejs";

const GRANTABLE_KEYS = new Set(GRANTABLE_FEATURES.map((f) => f.key));
const STATUSES: UserStatus[] = ["PENDING", "ACTIVE", "SUSPENDED"];

async function guard() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin(me.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { me };
}

function normalizeRoles(input: unknown): Role[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(input.filter((r): r is Role => ALL_ROLES.includes(r as Role))),
  );
}

function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((k) => GRANTABLE_KEYS.has(k as never))));
}

// PATCH /api/admin/users/[id] — update roles, permissions, status, profile,
// or reset the password.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const g = await guard();
  if (g.error) return g.error;

  let body: {
    name?: string;
    phone?: string;
    roles?: unknown;
    permissions?: unknown;
    status?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!body.name.trim())
      return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    data.name = body.name.trim();
  }
  if (body.phone !== undefined) data.phone = body.phone.trim() || null;
  if (body.roles !== undefined) {
    const roles = normalizeRoles(body.roles);
    if (roles.length === 0)
      return NextResponse.json(
        { error: "At least one role is required." },
        { status: 400 },
      );
    data.roles = roles;
  }
  if (body.permissions !== undefined) data.permissions = normalizePermissions(body.permissions);
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as UserStatus))
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    // Guard: don't let an admin suspend the last remaining active admin.
    if (body.status === "SUSPENDED" && isAdmin(target.roles)) {
      const activeAdmins = await prisma.user.count({
        where: { roles: { has: "ADMIN" }, status: { not: "SUSPENDED" } },
      });
      if (activeAdmins <= 1)
        return NextResponse.json(
          { error: "You cannot suspend the last active admin." },
          { status: 400 },
        );
    }
    data.status = body.status;
  }
  if (body.password !== undefined && body.password !== "") {
    if (body.password.length < 8)
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    data.passwordHash = await hashPassword(body.password);
    data.mustChangePassword = true;
  }

  const updated = await prisma.user.update({ where: { id: params.id }, data });
  return NextResponse.json({ ok: true, id: updated.id });
}

// DELETE /api/admin/users/[id] — remove an employee (queries they were
// assigned fall back to unassigned via the schema's SetNull).
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const g = await guard();
  if (g.error) return g.error;

  if (g.me!.id === params.id)
    return NextResponse.json(
      { error: "You cannot delete your own account." },
      { status: 400 },
    );

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Not found." }, { status: 404 });

  if (isAdmin(target.roles)) {
    const admins = await prisma.user.count({ where: { roles: { has: "ADMIN" } } });
    if (admins <= 1)
      return NextResponse.json(
        { error: "You cannot delete the last admin." },
        { status: 400 },
      );
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
