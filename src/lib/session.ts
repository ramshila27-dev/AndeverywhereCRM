// Edge-safe session helpers: sign / verify the session JWT with `jose`.
// This module must NOT import Prisma or bcrypt so it can run in middleware
// (the edge runtime). Server components use src/lib/auth.ts, which builds on it.

import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "ae_session";
const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    // Dev fallback so the app still boots without a configured secret.
    return new TextEncoder().encode("dev-insecure-secret-change-me");
  }
  return new TextEncoder().encode(s);
}

export interface SessionPayload {
  uid: string;
  name: string;
  admin: boolean;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.uid !== "string") return null;
    return {
      uid: payload.uid,
      name: typeof payload.name === "string" ? payload.name : "",
      admin: payload.admin === true,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
