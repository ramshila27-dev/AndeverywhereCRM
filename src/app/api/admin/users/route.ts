import { NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { isAdmin, permissionsForRoles, ALL_ROLES, GRANTABLE_FEATURES } from "@/lib/permissions";

export const runtime = "nodejs";

const GRANTABLE_KEYS = new Set(GRANTABLE_FEATURES.map((f) => f.key));

async function guard() {
  const me = await getCurrentUser();
  if (!me) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin(me.roles))
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { me };
}

function normalizeRoles(input: unknown): Role[] {
  if (!Array.isArray(input)) return [];
  const roles = input.filter((r): r is Role => ALL_ROLES.includes(r as Role));
  return Array.from(new Set(roles));
}

// Keep only valid grantable feature keys.
function normalizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((k) => GRANTABLE_KEYS.has(k as never))));
}

// POST /api/admin/users — create an employee.
export async function POST(req: Request) {
  const g = await guard();
  if (g.error) return g.error;

  let body: {
    name?: string;
    email?: string;
    password?: string;
    phone?: string;
    roles?: unknown;
    permissions?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );

  let roles = normalizeRoles(body.roles);
  if (roles.length === 0) roles = ["SALES_PERSON"];

  // Permissions default to the role presets; admin may have overridden them.
  const permissions =
    body.permissions === undefined
      ? permissionsForRoles(roles)
      : normalizePermissions(body.permissions);

  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        phone: body.phone?.trim() || null,
        passwordHash: await hashPassword(password),
        roles,
        permissions,
        status: "PENDING",
        mustChangePassword: true,
      },
    });
    return NextResponse.json({ ok: true, id: user.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 },
      );
    }
    throw e;
  }
}
