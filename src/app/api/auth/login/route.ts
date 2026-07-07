import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { startSession, verifyPassword, landingFor } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/auth/login  { email, password }
export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Same message whether the email is unknown or the password is wrong.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }
  if (user.status === "SUSPENDED") {
    return NextResponse.json(
      { error: "This account has been suspended. Contact your admin." },
      { status: 403 },
    );
  }

  // First successful login flips PENDING -> ACTIVE and stamps activity.
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      status: user.status === "PENDING" ? "ACTIVE" : user.status,
      lastActiveAt: new Date(),
    },
  });

  await startSession(updated);

  return NextResponse.json({
    ok: true,
    mustChangePassword: updated.mustChangePassword,
    redirect: updated.mustChangePassword ? "/account/password" : landingFor(updated),
  });
}
