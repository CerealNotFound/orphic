// Offline bot test: feeds fake Telegram updates through the real handlers and prints what the bot would send.
// Usage: pnpm tsx --env-file=.env.local scripts/test-bot.ts <invite-code>
process.env.TELEGRAM_BOT_TOKEN ||= "123:FAKE";
process.env.TELEGRAM_BOT_USERNAME ||= "orphic_test_bot";

const { createBot } = await import("../src/lib/telegram/bot");
const { pool } = await import("../src/lib/db");

const bot = createBot();
let msgId = 1000;
const sent: { method: string; payload: Record<string, unknown> }[] = [];
bot.api.config.use(async (_prev, method, payload) => {
  sent.push({ method, payload: payload as Record<string, unknown> });
  const result =
    method === "getMe"
      ? { id: 1, is_bot: true, first_name: "Orphic", username: "orphic_test_bot", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: true }
      : method === "sendMessage"
        ? { message_id: ++msgId, date: 0, chat: { id: (payload as { chat_id: number }).chat_id, type: "private" }, text: "" }
        : true;
  return { ok: true, result } as never;
});

await bot.init();
let updateId = 1;
const user = (id: number, first: string) => ({ id, is_bot: false, first_name: first });
const message = (from: ReturnType<typeof user>, text: string) => ({
  update_id: updateId++,
  message: {
    message_id: ++msgId,
    date: Math.floor(Date.now() / 1000),
    chat: { id: from.id, type: "private" as const, first_name: from.first_name },
    from,
    text,
    ...(text.startsWith("/") ? { entities: [{ type: "bot_command" as const, offset: 0, length: text.split(" ")[0].length }] } : {}),
  },
});

async function step(label: string, update: object) {
  sent.length = 0;
  await bot.handleUpdate(update as never);
  console.log(`\n=== ${label}`);
  for (const s of sent.filter((s) => s.method !== "getMe")) {
    const text = (s.payload.text as string | undefined) ?? JSON.stringify(s.payload.results ?? s.payload).slice(0, 300);
    const kb = (s.payload.reply_markup as { inline_keyboard?: { text: string }[][] } | undefined)?.inline_keyboard;
    console.log(`[${s.method}] ${text.slice(0, 500)}${kb ? `\n  buttons: ${kb.map((r) => r.map((b) => b.text).join(" | ")).join(" / ")}` : ""}`);
  }
}

const invite = process.argv[2];
const neha = user(333, "Neha");
const riya = user(222, "Riya");

await step("stranger says hi", message(user(999, "Stranger"), "hello"));
await step("Neha joins with invite", message(neha, `/start ${invite}`));
await step("Neha shares a new reel with a note", message(neha, "https://www.instagram.com/reel/NEWreel123/?igsh=xyz for the ads project"));
await step("Neha shares the same reel again", message(neha, "https://www.instagram.com/reel/NEWreel123/"));
await step("Neha shares a reel Riya already saved", message(neha, "https://www.instagram.com/reel/DIOuZGXMtPm/"));
const doc = (from: ReturnType<typeof user>, file_name: string, mime_type: string, file_size: number, caption?: string) => ({
  update_id: updateId++,
  message: {
    message_id: ++msgId,
    date: Math.floor(Date.now() / 1000),
    chat: { id: from.id, type: "private" as const, first_name: from.first_name },
    from,
    document: { file_id: `file-${file_name}-${msgId}`, file_unique_id: `uniq-${file_name}-${msgId}`, file_name, mime_type, file_size },
    ...(caption ? { caption } : {}),
  },
});
await step("Neha sends a PDF file", doc(neha, "claude-mods.pdf", "application/pdf", 350_000, "mods guide from Jake"));
await step("Neha sends a Word file", doc(neha, "notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 20_000));
await step("Neha sends a program", doc(neha, "setup.exe", "application/octet-stream", 2_000_000));
await step("Neha sends a macro Word file", doc(neha, "invoice.docm", "application/vnd.ms-word.document.macroEnabled.12", 40_000));
await step("Neha sends a 30 MB PDF", doc(neha, "big.pdf", "application/pdf", 30 * 1024 * 1024));
await step("Riya searches in plain English", message(riya, "tool to make ads from product photo"));
await step("Riya searches for something missing", message(riya, "best tool for podcast transcripts"));
await step("Neha checks pending", message(neha, "/pending"));
await step("/recent", message(riya, "/recent"));
await step("inline query", { update_id: updateId++, inline_query: { id: "iq1", from: riya, query: "capcut", offset: "" } });
await step("Riya rates Higgsfield 👍", {
  update_id: updateId++,
  callback_query: { id: "cb1", from: riya, chat_instance: "x", data: `rate:${(await pool.query("select id from entities where slug='higgsfield'")).rows[0].id}:1` },
});

await pool.end();
