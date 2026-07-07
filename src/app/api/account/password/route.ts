import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
  startSession,
} from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/account/password  { currentPassword?, newPassword }
// currentPassword is optional when the user is on a forced first-login change.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const newPassword = body.newPassword ?? "";
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }

  // Verify the current password unless this is a forced first-login change.
  if (!user.mustChangePassword) {
    const ok = await verifyPassword(body.currentPassword ?? "", user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    },
  });

  // Refresh the session cookie (name/admin unchanged, but keeps it alive).
  await startSession(updated);

  return NextResponse.json({ ok: true });
}
