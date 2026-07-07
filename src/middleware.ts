import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

// Routes reachable without a session.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// Everything else requires a valid session. Static assets, Next internals and
// runtime-uploaded images are excluded via the matcher below.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (isPublic) {
    // Already-authenticated users shouldn't sit on the login page.
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    // API calls get a 401; page navigations get bounced to /login.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals, static files, the favicon and the
  // uploaded-image route (public images are fetched without a session).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.).*)"],
};
