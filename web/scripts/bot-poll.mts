// Local development: run the bot with long polling instead of a webhook (no public URL needed).
// Note: this removes the Telegram webhook. Run `pnpm orphic webhook <url>` again after deploying.
import { createBot } from "../src/lib/telegram/bot";

const bot = createBot();
await bot.api.deleteWebhook();
const me = await bot.api.getMe();
console.log(`Polling as @${me.username}. Ctrl+C to stop.`);
if (process.env.TELEGRAM_BOT_USERNAME !== me.username) console.warn(`Tip: set TELEGRAM_BOT_USERNAME=${me.username} in .env.local`);
process.once("SIGINT", () => bot.stop());
process.once("SIGTERM", () => bot.stop());
await bot.start({ allowed_updates: ["message", "callback_query", "inline_query"] });
