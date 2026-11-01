// How Orphic items look in Telegram (HTML parse mode).
import { InlineKeyboard } from "grammy";
import { env } from "../env";
import type { EntityHit, Page } from "../search";
import { esc, truncate } from "../text";

const KIND_ICON: Record<string, string> = {
  tool: "🛠",
  workflow: "🔁",
  prompt: "💬",
  template: "📄",
  repo: "💻",
  course: "🎓",
  resource: "📦",
  other: "📌",
};

export const entityUrl = (slug: string) => `${env.APP_URL}/tools/${slug}`;

function socialLine(e: Pick<EntityHit, "savers" | "save_count" | "rating_score">) {
  const parts: string[] = [];
  if (e.savers?.length) parts.push(`👥 ${esc(e.savers.slice(0, 3).join(", "))}${e.savers.length > 3 ? ` +${e.savers.length - 3}` : ""}`);
  if (e.rating_score > 0) parts.push(`👍 ${e.rating_score}`);
  if (e.rating_score < 0) parts.push(`👎 ${-e.rating_score}`);
  return parts.join(" · ");
}

export function entityCard(e: EntityHit, opts: { header?: string; alsoSavedBy?: string[] } = {}) {
  const lines: string[] = [];
  if (opts.header) lines.push(opts.header);
  const status = e.link_status === "verified" ? "✅" : e.link_status === "pending_dm" ? "⏳" : e.link_status === "unavailable" ? "🚫" : e.link_status === "saved" ? "📦" : "🔎";
  lines.push(`${status} ${KIND_ICON[e.kind] ?? "📌"} <b>${esc(e.name)}</b>${e.pricing ? ` <i>(${esc(e.pricing)})</i>` : ""}`);
  if (e.summary) lines.push(esc(truncate(e.summary, 300)));
  if (e.use_cases?.length) lines.push(`<i>Use it to: ${esc(e.use_cases.slice(0, 3).join("; "))}</i>`);
  if (e.canonical_url) lines.push(`🔗 ${esc(e.canonical_url)}`);
  else if (e.link_status === "pending_dm") lines.push(`🔒 Link is behind the creator's DM`);
  else if (e.link_status === "saved") lines.push(`📦 No public link: the content is saved in Orphic`);
  else if (e.link_status === "unavailable") lines.push(`🚫 The creator's DM never came, so there's no link`);
  const tagLine = [e.category, ...(e.tags ?? []).slice(0, 4)].filter(Boolean).join(" · ");
  if (tagLine) lines.push(`🏷 ${esc(tagLine)}`);
  if (opts.alsoSavedBy?.length) lines.push(`Also saved by ${esc(opts.alsoSavedBy.join(", "))}`);
  const social = socialLine(e);
  if (social) lines.push(social);
  return lines.join("\n");
}

export function entityKeyboard(e: Pick<EntityHit, "id" | "slug" | "canonical_url">) {
  const kb = new InlineKeyboard();
  if (e.canonical_url) kb.url("🔗 Open", e.canonical_url);
  kb.text("👍 Works", `rate:${e.id}:1`).text("👎 Meh", `rate:${e.id}:-1`);
  if (isPublicUrl(env.APP_URL)) kb.row().url("📖 Details", entityUrl(e.slug));
  return kb;
}

export function pendingDmCard(e: EntityHit, keyword: string | null, reelUrl: string | null) {
  const lines = [
    `⏳ <b>${esc(e.name)}</b>${e.creator_handle ? ` by @${esc(e.creator_handle)}` : ""}`,
    e.summary ? esc(truncate(e.summary, 250)) : "",
    "",
    keyword
      ? `This one is behind the creator's DM. Comment <b>${esc(keyword)}</b> on the reel, then forward me the link they send you.`
      : `This one is behind the creator's DM or bio link. Grab the link and forward it to me.`,
  ];
  if (reelUrl) lines.push(`Reel: ${esc(reelUrl)}`);
  return lines.filter((l) => l !== "").join("\n");
}

export function searchResults(query: string, page: Page<EntityHit>) {
  if (page.total === 0) {
    return `🔎 Nothing in Orphic matches <b>${esc(truncate(query, 80))}</b> yet.\nTry other words, or send me a reel about it.`;
  }
  const lines = [
    `🔎 <b>${esc(truncate(query, 80))}</b>: showing ${page.offset + 1}–${page.offset + page.items.length} of ${page.total}`,
    "",
  ];
  page.items.forEach((e, i) => {
    const n = page.offset + i + 1;
    const meta = [e.domain, e.save_count > 1 ? `👥${e.save_count}` : null, e.rating_score ? `${e.rating_score > 0 ? "👍" : "👎"}${Math.abs(e.rating_score)}` : null]
      .filter(Boolean)
      .join(" · ");
    lines.push(`${n}. <b>${esc(e.name)}</b>: ${esc(truncate(e.summary, 120))}${meta ? `\n    <i>${esc(meta)}</i>` : ""}`);
  });
  return lines.join("\n");
}

export function searchKeyboard(query: string, page: Page<EntityHit>) {
  const kb = new InlineKeyboard();
  page.items.slice(0, 6).forEach((e, i) => {
    kb.text(`${page.offset + i + 1}. ${truncate(e.name, 24)}`, `ent:${e.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (page.next_offset !== null) kb.row().text(`More (${page.total - page.next_offset} left)`, `more:${page.next_offset}:${truncate(query, 40)}`);
  return kb;
}

/** Telegram rejects localhost URLs in buttons. */
export function isPublicUrl(url: string) {
  return /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url);
}
