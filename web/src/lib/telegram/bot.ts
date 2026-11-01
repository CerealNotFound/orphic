// The Orphic Telegram bot: capture (reels, links, screenshots) + search, for every teammate.
import { Bot, Context, InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import { env } from "../env";
import { q, q1 } from "../db";
import { addSave, answerJob, enqueueJob, findExistingCapture, retryJob, sourceKeyForJob, type JobInput, type JobKind } from "../jobs";
import { createInvite, memberByTelegramId, redeemInvite, type Member } from "../members";
import { createLinkToken } from "../link-tokens";
import { closeDmWait } from "../pending";
import { getEntity, recentSaves, searchEntities, type EntityHit } from "../search";
import { entityCard, entityKeyboard, isPublicUrl, searchKeyboard, searchResults } from "./cards";
import { esc, extractUrls, instagramShortcode, normalizeUrl, truncate } from "../text";

// Documents the bot accepts. Macro-enabled Office files (.docm etc.) are deliberately not on the list.
const DOC_EXTENSIONS = new Set(["pdf", "docx", "doc", "rtf", "odt", "txt", "md", "markdown", "csv"]);
const MAX_DOC_BYTES = 20 * 1024 * 1024; // Telegram's download limit for bots

type Ctx = Context & { member?: Member };

const HELP = `<b>Orphic</b> is the team's memory for tools and resources from reels.

<b>Save</b>: share a reel to me (Share → Telegram → Orphic). Links, screenshots and PDFs work too. Add a note in the same message if you like.
<b>Ask</b>: just type what you're looking for, e.g. <i>tool for podcast clips</i>.
<b>Anywhere</b>: type <code>@BOT …</code> in any chat to search.

/recent: latest saves from the team
/pending: links you still need to grab from a creator's DM
INVITE_LINE
/web: open Orphic on the web (search, tool pages, team feed)`;

function helpText(member?: Member) {
  return HELP.replace("@BOT", env.TELEGRAM_BOT_USERNAME ? `@${env.TELEGRAM_BOT_USERNAME}` : "@orphic")
    // Only the owner can invite people, so only they see the command.
    .replace("INVITE_LINE\n", member?.role === "owner" ? "/invite: invite link for a teammate\n" : "");
}

export function createBot() {
  const bot = new Bot<Ctx>(env.TELEGRAM_BOT_TOKEN);

  // Who is this? Only team members can use the bot.
  bot.use(async (ctx, next) => {
    if (ctx.from) ctx.member = (await memberByTelegramId(ctx.from.id)) ?? undefined;
    await next();
  });

  bot.command("start", async (ctx) => {
    const code = ctx.match?.trim();
    if (code && ctx.from) {
      const res = await redeemInvite(code, { id: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name, lastName: ctx.from.last_name });
      if ("error" in res) return void (await ctx.reply(res.error));
      const welcome = res.created ? `Welcome to Orphic, ${esc(res.member.display_name)}! 🎉\n\n` : "You're already in. ";
      return void (await ctx.reply(welcome + helpText(res.member), { parse_mode: "HTML" }));
    }
    if (!ctx.member) return void (await ctx.reply("Hi! Orphic is invite-only. Ask the team owner for an invite link."));
    await ctx.reply(helpText(ctx.member), { parse_mode: "HTML" });
  });

  // Everything below requires membership.
  bot.use(async (ctx, next) => {
    if (ctx.member) return next();
    if (ctx.inlineQuery) return void (await ctx.answerInlineQuery([], { cache_time: 5, button: { text: "Join Orphic first", start_parameter: "join" } }));
    if (ctx.callbackQuery) return void (await ctx.answerCallbackQuery({ text: "You're not in this Orphic team." }));
    if (ctx.chat?.type === "private") await ctx.reply("Orphic is invite-only. Ask the team owner for an invite link.");
  });

  bot.command("help", (ctx) => ctx.reply(helpText(ctx.member), { parse_mode: "HTML" }));

  bot.command("invite", async (ctx) => {
    const m = ctx.member!;
    if (m.role !== "owner") return void (await ctx.reply("Only the team owner can invite new people. Ask them for a link."));
    if (!env.TELEGRAM_BOT_USERNAME) return void (await ctx.reply("Set TELEGRAM_BOT_USERNAME on the server first."));
    const code = await createInvite(m.workspace_id, { createdBy: m.id });
    await ctx.reply(`Invite link (works for up to 50 people):\nhttps://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${code}`, {
      link_preview_options: { is_disabled: true },
    });
  });

  bot.command("web", async (ctx) => {
    if (ctx.chat.type !== "private") return void (await ctx.reply("DM me /web to get your personal sign-in link."));
    const token = await createLinkToken(ctx.member!.id);
    const url = `${env.APP_URL}/connect?token=${token}`;
    await ctx.reply(
      `🌐 Your personal link to Orphic on the web (valid 30 min):\n${url}\n\nOpen it to create your login (email + password), or to set a new password if you forgot it. After that just sign in at ${env.APP_URL}`,
      { link_preview_options: { is_disabled: true }, reply_markup: isPublicUrl(url) ? new InlineKeyboard().url("Open Orphic", url) : undefined },
    );
  });

  bot.command("setgroup", async (ctx) => {
    const m = ctx.member!;
    if (ctx.chat.type === "private") return void (await ctx.reply("Run /setgroup inside the team group."));
    if (m.role === "member") return void (await ctx.reply("Only an owner or admin can set the team group."));
    await q(`update workspaces set telegram_group_chat_id = $2 where id = $1`, [m.workspace_id, ctx.chat.id]);
    await ctx.reply("✅ This is now the team group. The weekly digest will be posted here.");
  });

  bot.command("recent", async (ctx) => {
    const rows = await recentSaves(ctx.member!.workspace_id, 10);
    if (!rows.length) return void (await ctx.reply("Nothing saved yet. Share a reel to me to start!"));
    const lines = rows.map((r) => {
      const what = r.entity_name ? `<b>${esc(r.entity_name)}</b>` : r.status === "pending_dm" ? "⏳ (waiting on DM link)" : "❓ (unidentified)";
      return `• ${what}: ${esc(truncate(r.summary ?? "", 80))} <i>(${esc(r.member)})</i>`;
    });
    await ctx.reply(`🕑 <b>Latest saves</b>\n\n${lines.join("\n")}`, { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
  });

  bot.command("pending", async (ctx) => {
    const rows = await q<{ id: string; entity_id: string | null; keyword: string | null; name: string | null; creator: string | null; url: string | null }>(
      `select t.id, t.entity_id, t.keyword, e.name, coalesce(e.creator_handle, c.creator_handle) as creator, c.source_url as url
       from tasks t left join entities e on e.id = t.entity_id left join captures c on c.id = t.capture_id
       where t.member_id = $1 and t.status = 'open' order by t.created_at`,
      [ctx.member!.id],
    );
    if (!rows.length) return void (await ctx.reply("Nothing pending. 🙌"));
    const lines = rows.map(
      (r) => `• <b>${esc(r.name ?? "Resource")}</b>${r.creator ? ` (@${esc(r.creator)})` : ""}${r.keyword ? `: comment <b>${esc(r.keyword)}</b>` : ""}${r.url ? `\n  ${esc(r.url)}` : ""}`,
    );
    const kb = new InlineKeyboard();
    for (const r of rows) if (r.entity_id) kb.text(`🚫 Never came: ${truncate(r.name ?? "item", 28)}`, `nodm:${r.entity_id}`).row();
    await ctx.reply(
      `⏳ <b>Waiting on DM links</b>\nForward me the link once the creator sends it. If their DM never came, tap 🚫 to close it.\n\n${lines.join("\n")}`,
      { parse_mode: "HTML", link_preview_options: { is_disabled: true }, reply_markup: rows.some((r) => r.entity_id) ? kb : undefined },
    );
  });

  bot.command("search", async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) return void (await ctx.reply("Usage: /search tool for podcast clips"));
    await replySearch(ctx, query);
  });

  // Screenshots.
  bot.on("message:photo", async (ctx) => {
    const photo = ctx.message.photo.at(-1)!;
    const note = ctx.message.caption?.trim() || undefined;
    await capture(ctx, "image", { telegram_file_id: photo.file_id, telegram_file_unique_id: photo.file_unique_id, note });
  });
  bot.on("message:document", async (ctx) => {
    const d = ctx.message.document;
    const note = ctx.message.caption?.trim() || undefined;
    if (d.mime_type?.startsWith("image/")) return void (await capture(ctx, "image", { telegram_file_id: d.file_id, telegram_file_unique_id: d.file_unique_id, note }));
    // Documents (PDF, Word, text). The worker re-checks the real file contents before opening anything.
    const ext = (d.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";
    if (!DOC_EXTENSIONS.has(ext))
      return void (await ctx.reply("I can read PDFs, Word documents (.docx, .doc), .rtf, .odt and text files (.txt, .md, .csv). For other files, send me a link instead."));
    if ((d.file_size ?? 0) > MAX_DOC_BYTES)
      return void (await ctx.reply("That file is over 20 MB, which is Telegram's limit for bots. Upload it to Google Drive (anyone with the link can view) and send me the link instead."));
    await capture(ctx, "file", {
      telegram_file_id: d.file_id,
      telegram_file_unique_id: d.file_unique_id,
      file_name: d.file_name ?? `document.${ext}`,
      mime_type: d.mime_type,
      file_size: d.file_size,
      note,
    });
  });
  bot.on(["message:voice", "message:audio", "message:video"], (ctx) =>
    ctx.reply("Send me the reel's link instead (Share → Telegram). Voice search is coming soon."),
  );

  // Links → capture; plain text → search.
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    // A pasted document (guide, DM, notes). Telegram splits long pastes into several messages; they're merged into one job.
    if (ctx.chat.type === "private" && (text.length > 600 || text.split("\n").length > 10)) {
      await capturePaste(ctx, text);
      return;
    }
    const entityUrls = (ctx.message.entities ?? []).filter((e) => e.type === "text_link").map((e) => (e as { url: string }).url);
    const urls = [...new Set([...extractUrls(text), ...entityUrls])];
    const isGroup = ctx.chat.type !== "private";
    const mention = env.TELEGRAM_BOT_USERNAME ? new RegExp(`@${env.TELEGRAM_BOT_USERNAME}\\b`, "i") : null;
    if (isGroup && !(mention && mention.test(text))) return; // in groups, only act when mentioned

    if (urls.length) {
      let note = text;
      for (const u of urls) note = note.replace(u, "");
      if (mention) note = note.replace(mention, "");
      note = note.trim();
      for (const url of urls.slice(0, 10)) {
        // Strip tracking/personal tokens (utm, fbclid, ManyChat mcp_token…) before anything is stored.
        await capture(ctx, instagramShortcode(url) ? "reel" : "link", { url: normalizeUrl(url), note: note || undefined });
      }
      return;
    }
    const query = mention ? text.replace(mention, "").trim() : text.trim();
    if (query) await replySearch(ctx, query);
  });

  // @bot query in any chat.
  bot.on("inline_query", async (ctx) => {
    const query = ctx.inlineQuery.query.trim();
    const offset = Number(ctx.inlineQuery.offset || 0);
    const page = await searchEntities(ctx.member!.workspace_id, query, { limit: 10, offset });
    const results = page.items.map((e) =>
      InlineQueryResultBuilder.article(e.id, e.name, {
        description: truncate(e.summary, 120),
        url: e.canonical_url ?? undefined,
        reply_markup: e.canonical_url ? new InlineKeyboard().url("🔗 Open", e.canonical_url) : undefined,
      }).text(entityCard(e), { parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
    );
    await ctx.answerInlineQuery(results, { cache_time: 10, is_personal: true, next_offset: page.next_offset !== null ? String(page.next_offset) : "" });
  });

  // Buttons.
  bot.callbackQuery(/^rate:([0-9a-f-]{36}):(-?1)$/, async (ctx) => {
    const [, entityId, v] = ctx.match;
    const m = ctx.member!;
    const ok = await q1(`select 1 from entities where id = $1 and workspace_id = $2`, [entityId, m.workspace_id]);
    if (!ok) return void (await ctx.answerCallbackQuery({ text: "Not found" }));
    await q(
      `insert into ratings (entity_id, member_id, workspace_id, value) values ($1, $2, $3, $4)
       on conflict (entity_id, member_id) do update set value = excluded.value, created_at = now()`,
      [entityId, m.id, m.workspace_id, Number(v)],
    );
    await q(`update entities set rating_score = (select coalesce(sum(value), 0) from ratings where entity_id = $1) where id = $1`, [entityId]);
    await ctx.answerCallbackQuery({ text: Number(v) > 0 ? "👍 Noted, it works" : "👎 Noted, meh" });
  });

  bot.callbackQuery(/^ans:(\d+):(\d+)$/, async (ctx) => {
    const answer = await answerJob(Number(ctx.match[1]), ctx.member!.id, Number(ctx.match[2]));
    if (answer === null) return void (await ctx.answerCallbackQuery({ text: "Already answered" }));
    await ctx.answerCallbackQuery({ text: "Thanks!" });
    await ctx.editMessageText(`⏳ #${ctx.match[1]}: got it (<b>${esc(answer)}</b>), finishing up…`, { parse_mode: "HTML" }).catch(() => {});
  });

  bot.callbackQuery(/^retry:(\d+)$/, async (ctx) => {
    const ok = await retryJob(Number(ctx.match[1]), ctx.member!.id);
    await ctx.answerCallbackQuery({ text: ok ? "Retrying…" : "Can't retry this one" });
    if (ok) await ctx.editMessageText(`⏳ #${ctx.match[1]}: retrying…`).catch(() => {});
  });

  bot.callbackQuery(/^nodm:([0-9a-f-]{36})$/, async (ctx) => {
    const closed = await closeDmWait(ctx.member!.workspace_id, ctx.match[1]);
    await ctx.answerCallbackQuery({ text: closed ? `Closed: ${closed.name}` : "Already closed" });
    if (closed) await ctx.reply(`🚫 Closed <b>${esc(closed.name)}</b>: the creator's DM never came. It stays searchable, marked "no link". If the link turns up later, just forward it to me.`, { parse_mode: "HTML" });
  });

  bot.callbackQuery(/^commented:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: "Nice! Forward me the link when their DM arrives." });
  });

  bot.callbackQuery(/^ent:([0-9a-f-]{36})$/, async (ctx) => {
    const e = await getEntity(ctx.member!.workspace_id, ctx.match[1]);
    await ctx.answerCallbackQuery();
    if (!e) return;
    await ctx.reply(entityCard(e as EntityHit), { parse_mode: "HTML", reply_markup: entityKeyboard(e), link_preview_options: { is_disabled: true } });
  });

  bot.callbackQuery(/^more:(\d+):([\s\S]+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await replySearch(ctx, ctx.match[2], Number(ctx.match[1]));
  });

  bot.catch((err) => console.error("bot error", err.error));
  return bot;
}

async function replySearch(ctx: Ctx, query: string, offset = 0) {
  const page = await searchEntities(ctx.member!.workspace_id, query, { limit: 5, offset });
  const kb = searchKeyboard(query, page);
  if (isPublicUrl(env.APP_URL) && page.total > 0) kb.row().url("🌐 Open in Orphic", `${env.APP_URL}/?q=${encodeURIComponent(query)}`);
  const hasButtons = kb.inline_keyboard.some((row) => row.length > 0);
  await ctx.reply(searchResults(query, page), { parse_mode: "HTML", reply_markup: hasButtons ? kb : undefined, link_preview_options: { is_disabled: true } });
}

/** Long pasted text → one "text" job; follow-up chunks within 2 minutes are appended to the same job. */
async function capturePaste(ctx: Ctx, text: string) {
  const m = ctx.member!;
  const open = await q1<{ id: string; telegram_message_id: string | null }>(
    `update jobs set input = jsonb_set(input, '{text}', to_jsonb(coalesce(input->>'text', '') || E'\n' || $2::text)), updated_at = now()
     where id = (select id from jobs where member_id = $1 and kind = 'text' and status = 'queued' and created_at > now() - interval '2 minutes'
                 order by id desc limit 1)
     returning id, telegram_message_id`,
    [m.id, text],
  );
  if (open) return; // merged into the job we already acknowledged
  const status = await ctx.reply("📥 Got it, reading the whole text…", { reply_parameters: { message_id: ctx.msg!.message_id } });
  const jobId = await enqueueJob({ workspaceId: m.workspace_id, memberId: m.id, kind: "text", input: { text }, chatId: ctx.chat!.id, messageId: status.message_id });
  await ctx.api.editMessageText(ctx.chat!.id, status.message_id, `📥 Got it (#${jobId}). If it was long, send the rest now and I'll treat it as one document.`).catch(() => {});
}

async function capture(ctx: Ctx, kind: JobKind, input: JobInput) {
  const m = ctx.member!;
  const key = sourceKeyForJob(kind, input);

  if (key) {
    const existing = await findExistingCapture(m.workspace_id, key);
    if (existing?.entity_id) {
      await addSave(m.workspace_id, existing.capture_id, m.id, input.note);
      const e = await getEntity(m.workspace_id, existing.entity_id);
      if (e) {
        const others = existing.saved_by.filter((n) => n !== m.display_name);
        const header = others.length ? `📚 Already in Orphic (saved by ${esc(others.join(", "))}). Added your save.` : "📚 Already in Orphic. Added your save.";
        await ctx.reply(entityCard(e as EntityHit, { header }), {
          parse_mode: "HTML",
          reply_markup: entityKeyboard(e),
          link_preview_options: { is_disabled: true },
          reply_parameters: { message_id: ctx.msg!.message_id },
        });
        return;
      }
    }
    if (input.url) {
      const inFlight = await q1<{ id: string }>(
        `select id from jobs where workspace_id = $1 and status in ('queued', 'processing', 'needs_input') and input->>'source_key' = $2 limit 1`,
        [m.workspace_id, key],
      );
      if (inFlight) {
        await ctx.reply(`⏳ Already processing this one (#${inFlight.id}).`, { reply_parameters: { message_id: ctx.msg!.message_id } });
        return;
      }
    }
  }

  const status = await ctx.reply(`📥 Got it, processing…`, {
    reply_parameters: { message_id: ctx.msg!.message_id },
    link_preview_options: { is_disabled: true },
  });
  const jobId = await enqueueJob({ workspaceId: m.workspace_id, memberId: m.id, kind, input: { ...input, source_key: key ?? undefined }, chatId: ctx.chat!.id, messageId: status.message_id });
  await ctx.api.editMessageText(ctx.chat!.id, status.message_id, `📥 Got it (#${jobId}). Processing, usually under a minute.`).catch(() => {});
}
