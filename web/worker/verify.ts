import { safeFetch } from "./safety";

// `pnpm worker verify-url <url>`: a deterministic link check, so every model verifies links the same way.
// Follows redirects and reports the final URL, status, title and description; for GitHub repos also stars, licence and activity.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/\s+/g, " ").trim();

function meta(html: string, names: string[]): string | null {
  for (const n of names) {
    const m =
      html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]+content=["']([^"']+)["']`, "i")) ??
      html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${n}["']`, "i"));
    if (m) return decode(m[1]);
  }
  return null;
}

export async function verifyUrl(input: string): Promise<string> {
  const lines: string[] = [];
  let res: Response;
  try {
    res = await safeFetch(input, { headers: { "user-agent": UA, accept: "text/html,*/*" }, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    return `UNREACHABLE ${input}\nerror: ${String(err)}\nVerdict: do NOT set link_verified. Try the official domain from a web search instead.`;
  }
  const finalUrl = res.url || input;
  const html = (res.headers.get("content-type") ?? "").includes("html") ? (await res.text()).slice(0, 400_000) : "";
  const title = decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "") || null;
  const desc = meta(html, ["description", "og:description", "twitter:description"]);
  const site = meta(html, ["og:site_name", "application-name"]);
  const host = new URL(finalUrl).hostname.replace(/^www\./, "");

  lines.push(`${res.ok ? "OK" : "HTTP_" + res.status} ${finalUrl}`);
  if (finalUrl !== input) lines.push(`redirected from: ${input}`);
  lines.push(`domain: ${host}`);
  if (site) lines.push(`site name: ${site}`);
  if (title) lines.push(`title: ${title}`);
  if (desc) lines.push(`description: ${desc.slice(0, 400)}`);

  const gh = finalUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  if (gh) {
    try {
      const r = await fetch(`https://api.github.com/repos/${gh[1]}/${gh[2].replace(/\.git$/, "")}`, {
        headers: { "user-agent": "orphic-worker", accept: "application/vnd.github+json" },
        signal: AbortSignal.timeout(15_000),
      });
      if (r.ok) {
        const j = (await r.json()) as { full_name: string; description: string | null; stargazers_count: number; license: { spdx_id: string } | null; pushed_at: string; archived: boolean; topics?: string[]; homepage?: string | null };
        lines.push(`github: ${j.full_name} · ★ ${j.stargazers_count} · licence ${j.license?.spdx_id ?? "none"} · last push ${j.pushed_at.slice(0, 10)}${j.archived ? " · ARCHIVED" : ""}`);
        if (j.description) lines.push(`github description: ${j.description}`);
        if (j.homepage) lines.push(`homepage: ${j.homepage}`);
        if (j.topics?.length) lines.push(`topics: ${j.topics.join(", ")}`);
      } else lines.push(`github api: ${r.status} (repo may be private or renamed)`);
    } catch {
      lines.push("github api: unreachable");
    }
  }

  const challenge = !res.ok && (res.status === 403 || res.status === 503) && /just a moment|attention required|cloudflare|captcha/i.test(`${title ?? ""} ${html.slice(0, 5000)}`);
  if (challenge) {
    lines.push(
      "Verdict: PROTECTED. The site blocks automated checks (bot protection), which usually means it's a real, live site. " +
        "Set link_verified: true ONLY IF a web search shows this exact domain as the official site of the item. Otherwise leave it false.",
    );
    return lines.join("\n");
  }
  lines.push(
    res.ok
      ? "Verdict: reachable. Set link_verified: true ONLY IF the domain/title clearly match the item's name AND the description matches what the reel claims. Use the final URL above as canonical_url."
      : "Verdict: NOT reachable. Do not set link_verified. Look for the official site with a web search.",
  );
  return lines.join("\n");
}
