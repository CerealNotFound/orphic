import { Api, InlineKeyboard } from "grammy";
import { env } from "../env";

let api: Api | null = null;
export function tgApi(): Api {
  api ??= new Api(env.TELEGRAM_BOT_TOKEN);
  return api;
}

/** Edits a status message; falls back to sending a new one if it can't be edited. Never throws. */
export async function editOrSend(chatId: number, messageId: number | null, html: string, keyboard?: InlineKeyboard) {
  const opts = { parse_mode: "HTML" as const, reply_markup: keyboard, link_preview_options: { is_disabled: true } };
  try {
    if (messageId) {
      await tgApi().editMessageText(chatId, messageId, html, opts);
      return;
    }
  } catch (err) {
    if (String(err).includes("message is not modified")) return;
    console.warn("editMessageText failed, sending new message", String(err));
  }
  try {
    await tgApi().sendMessage(chatId, html, opts);
  } catch (err) {
    console.error("sendMessage failed", err);
  }
}
