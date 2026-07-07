// Server-side auth: password hashing, session cookie management, and helpers
// to load / require the current user in server components and route handlers.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "@/lib/session";
import { can, isAdmin, type FeatureKey } from "@/lib/permissions";
import type { User } from "@prisma/client";

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Establish a session for the given user (sets the cookie).
export async function startSession(user: User): Promise<void> {
  const token = await signSession({
    uid: user.id,
    name: user.name,
    admin: isAdmin(user.roles),
  });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Secure in production, but allow opting out for local HTTP deployments
    // accessed over a non-localhost address (see AUTH_INSECURE_COOKIE in
    // .env.example). localhost is already treated as a secure context.
    secure:
      process.env.NODE_ENV === "production" &&
      process.env.AUTH_INSECURE_COOKIE !== "true",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function endSession(): void {
  cookies().delete(SESSION_COOKIE);
}

// Load the current user from the session cookie. Cached per request so many
// server components can call it without repeat DB hits. Returns null if not
// logged in or the account is gone / suspended.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.uid } });
  if (!user || user.status === "SUSPENDED") return null;
  return user;
});

// Require a logged-in user; redirect to /login otherwise.
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdmin(user.roles)) redirect("/queries");
  return user;
}

// Require a specific feature permission; redirect to /login or a safe landing.
export async function requirePermission(key: FeatureKey): Promise<User> {
  const user = await requireUser();
  if (!can(user, key)) redirect(landingFor(user));
  return user;
}

// For route handlers: returns the user if they hold the permission, otherwise
// null (the caller should return 401/403). Does not redirect.
export async function apiUserWith(
  key: FeatureKey,
): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return can(user, key) ? user : null;
}

// First feature the user is allowed to see — used as a safe redirect target.
export function landingFor(user: User): string {
  if (isAdmin(user.roles)) return "/admin/users";
  if (can(user, "queries")) return "/queries";
  if (can(user, "quotes")) return "/quotes";
  if (can(user, "itineraries")) return "/";
  if (can(user, "rates")) return "/catalog";
  if (can(user, "reports")) return "/reports";
  return "/account";
}
