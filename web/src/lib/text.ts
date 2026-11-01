// URL + text helpers shared by the bot, the job queue and ingestion.

const URL_RE = /https?:\/\/[^\s<>"'()]+/gi;

export function extractUrls(text: string): string[] {
  const found = text.match(URL_RE) ?? [];
  return [...new Set(found.map((u) => u.replace(/[.,!?;:]+$/, "")))];
}

/** Returns the shortcode for Instagram reel/post/tv URLs, else null. */
export function instagramShortcode(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname) && !/(^|\.)instagr\.am$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/\/(?:[\w.]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const TRACKING_PARAMS = /^(utm_\w+|igsh|igshid|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|si|s|_hsenc|_hsmi|mibextid|usp|srtk|obrf|vrfl|cplk|uusp|mcp_token|psln|mdxt|exln)$/i;

/** Normalizes a URL for dedup: lowercase host, no tracking params, no fragment, no trailing slash. */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return url.trim();
  }
}

export function sourceKeyFor(url: string): string {
  const sc = instagramShortcode(url);
  return sc ? `ig:${sc}` : normalizeUrl(url);
}

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

/** Escapes text for Telegram HTML parse mode. */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
