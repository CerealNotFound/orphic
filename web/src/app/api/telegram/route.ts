import { webhookCallback } from "grammy";
import { createBot } from "@/lib/telegram/bot";
import { env } from "@/lib/env";

// One bot instance per warm function instance.
let handler: ((req: Request) => Promise<Response>) | null = null;

export async function POST(req: Request) {
  handler ??= webhookCallback(createBot(), "std/http", { secretToken: env.TELEGRAM_WEBHOOK_SECRET, timeoutMilliseconds: 25_000 });
  return handler(req);
}
