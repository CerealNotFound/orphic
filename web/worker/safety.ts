// Safety guards for the worker, which handles content from strangers (reels, pages, pasted text).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// ---------- 1. Never fetch private / local addresses (SSRF) ----------

function privateV4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}
/** IPv4 hidden inside IPv6 (::ffff:7f00:1, ::ffff:127.0.0.1, ::127.0.0.1, 64:ff9b::7f00:1) → dotted IPv4, else null. */
function embeddedV4(x: string): string | null {
  const m = x.match(/^(?:::ffff:|::|64:ff9b::)(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/);
  if (!m) return null;
  if (m[1]) return m[1];
  const hi = parseInt(m[2], 16), lo = parseInt(m[3], 16);
  return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
}
function privateV6(ip: string) {
  const x = ip.toLowerCase();
  const v4 = embeddedV4(x);
  if (v4) return privateV4(v4);
  // Any other IPv4-mapped / NAT64 form we can't parse is refused rather than guessed.
  if (x.startsWith("::ffff:") || x.startsWith("64:ff9b:")) return true;
  return x === "::1" || x === "::" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80");
}

/** Throws if the URL isn't plain http(s) on a public host (blocks localhost, LAN, cloud metadata, .local …). */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`Blocked: not a valid URL`);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error(`Blocked: only http(s) links are fetched`);
  if (u.username || u.password) throw new Error(`Blocked: links with embedded credentials`);
  const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan") || !host.includes(".") && !isIP(host))
    throw new Error(`Blocked: ${host} is a local address`);
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error(`Blocked: ${host} doesn't resolve`);
  for (const a of addrs) if (a.family === 4 ? privateV4(a.address) : privateV6(a.address)) throw new Error(`Blocked: ${host} points to a private address`);
  return u;
}

/** fetch() that checks every redirect hop with assertPublicUrl. */
export async function safeFetch(url: string, init: RequestInit = {}, maxHops = 6): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    Object.defineProperty(res, "url", { value: current });
    return res;
  }
  throw new Error("Blocked: too many redirects");
}

// ---------- 2. Never let secrets leave in a result ----------

/** Values of secret-looking environment variables (tokens, keys, passwords, DB credentials). */
function secretValues(): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!v || v.length < 8) continue;
    if (/TOKEN|SECRET|PASSWORD|API_KEY|WORKER_KEY|PRIVATE/i.test(k)) out.push(v);
    if (k === "DATABASE_URL") {
      try {
        const pw = new URL(v).password;
        if (pw && pw.length >= 6) out.push(pw);
      } catch {}
    }
  }
  return out;
}

const SECRET_PATTERNS: [string, RegExp][] = [
  ["an Orphic API key", /orp_[A-Za-z0-9_-]{20,}/],
  ["a Telegram bot token", /\b\d{8,10}:AA[A-Za-z0-9_-]{30,}\b/],
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["an Anthropic/OpenAI key", /\b(sk-ant-|sk-proj-|sk-)[A-Za-z0-9_-]{20,}/],
  ["an AWS key", /\bAKIA[0-9A-Z]{16}\b/],
];

/** Returns a reason if the text contains a secret; null if clean. */
export function findSecret(text: string): string | null {
  for (const v of secretValues()) if (text.includes(v)) return "a value from your .env settings";
  for (const [label, re] of SECRET_PATTERNS) if (re.test(text)) return label;
  return null;
}
