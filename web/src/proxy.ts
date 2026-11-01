// "/" is the public landing page for everyone. The team app (/app, /tools, …) needs a session; signed-out visitors go to /signin.
// Only checks that a session cookie exists; pages still verify the session and membership.
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV === "development" && process.env.ORPHIC_DEV_MEMBER_ID) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();
  return NextResponse.redirect(new URL("/signin", request.url));
}

export const config = {
  // App pages only: not the landing page, the API, auth pages or static files.
  matcher: ["/app", "/tools/:path*", "/pending", "/team", "/connect-ai"],
};
