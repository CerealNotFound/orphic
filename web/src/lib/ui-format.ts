// Pure formatting helpers for the web UI.

/** "just now", "5m ago", "3h ago", "2d ago", else "12 Oct" / "12 Oct 2025". Call only at request time (uses the clock). */
export function timeAgo(value: string | Date, now = Date.now()): string {
  const d = new Date(value);
  const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function fullDate(value: string | Date): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "ai-video" → "AI video", "llm-chat-assistants" → "LLM chat assistants". */
export function humanize(slug: string): string {
  const words = slug.split("-").map((w) => (["ai", "llm", "crm", "ui", "ux", "ugc", "seo"].includes(w) ? w.toUpperCase() : w));
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const KIND_ICON: Record<string, string> = {
  tool: "🛠️",
  workflow: "🔁",
  prompt: "💬",
  template: "📄",
  repo: "📦",
  course: "🎓",
  resource: "📚",
  other: "✨",
};

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Keeps only http(s) URLs so stored links can't become javascript: hrefs. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

const PLATFORMS: { host: RegExp; name: string; profile?: (h: string) => string }[] = [
  { host: /(^|\.)(instagram\.com|instagr\.am)$/, name: "Instagram", profile: (h) => `https://www.instagram.com/${h}/` },
  { host: /(^|\.)tiktok\.com$/, name: "TikTok", profile: (h) => `https://www.tiktok.com/@${h}` },
  { host: /(^|\.)(x\.com|twitter\.com)$/, name: "X", profile: (h) => `https://x.com/${h}` },
  { host: /(^|\.)threads\.(net|com)$/, name: "Threads", profile: (h) => `https://www.threads.com/@${h}` },
  { host: /(^|\.)(youtube\.com|youtu\.be)$/, name: "YouTube", profile: (h) => `https://www.youtube.com/@${h}` },
  // LinkedIn profile addresses don't match the creator's handle, so we link to their post instead.
  { host: /(^|\.)linkedin\.com$/, name: "LinkedIn" },
];

/** The site a source URL is on ("Instagram", "LinkedIn"…), or null for other sites. */
export function platformName(url: string | null | undefined): string | null {
  const u = safeUrl(url);
  if (!u) return null;
  const host = new URL(u).hostname.toLowerCase();
  return PLATFORMS.find((p) => p.host.test(host))?.name ?? null;
}

/**
 * Where to send people for "@creator on …": their profile on the site the post came from,
 * or the post itself when that site's profile address can't be built from the handle.
 * Null when we don't know the site (we never guess Instagram for a LinkedIn creator).
 */
export function creatorLink(handle: string | null | undefined, sourceUrls: (string | null | undefined)[]): { href: string; site: string } | null {
  const h = handle?.replace(/^@/, "").trim();
  if (!h) return null;
  for (const raw of sourceUrls) {
    const u = safeUrl(raw);
    if (!u) continue;
    const host = new URL(u).hostname.toLowerCase();
    const p = PLATFORMS.find((x) => x.host.test(host));
    if (p) return { href: p.profile ? p.profile(encodeURIComponent(h)) : u, site: p.name };
  }
  return null;
}
