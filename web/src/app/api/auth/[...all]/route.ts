import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

// Accounts are created only through a teammate's /web connect link (server action), never by public sign-up.
export async function POST(req: Request) {
  if (new URL(req.url).pathname.endsWith("/sign-up/email")) {
    return Response.json({ message: "Sign-up is invite-only. Send /web to the Orphic bot in Telegram." }, { status: 403 });
  }
  return handler.POST(req);
}
