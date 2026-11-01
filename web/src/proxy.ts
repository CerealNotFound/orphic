// Signed-out visitors: "/" shows the public "coming soon" page (same URL), other app pages go to /signin.
// Only checks that a session cookie exists; pages still verify the session and membership.
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "development" && process.env.ORPHIC_DEV_MEMBER_ID) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  if (request.nextUrl.pathname === "/") return NextResponse.rewrite(new URL("/welcome", request.url));
  return NextResponse.redirect(new URL("/signin", request.url));
}

export const config = {
  // App pages only: not the API, auth pages, the public page or static files.
  matcher: ["/", "/tools/:path*", "/pending", "/team", "/connect-ai"],
};
