// Quality gate for worker results. `pnpm worker submit` runs this and refuses to send a result with errors,
// so any model driving the worker (Opus, Sonnet, Haiku…) has to meet the same bar.
import type { JobResult } from "../src/lib/contracts";

export type Finding = { level: "error" | "warning"; path: string; message: string };

const SHORTENERS = /^(bit\.ly|tinyurl\.com|t\.co|linktr\.ee|beacons\.ai|lnk\.bio|stan\.store|instagram\.com|l\.instagram\.com|youtu\.be)$/i;
const NON_LATIN = /[ऀ-ॿ؀-ۿЀ-ӿ一-鿿]/; // Devanagari, Arabic, Cyrillic, CJK
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// "5 GitHub repos…", "Top 10 AI tools…", "3 free Claude Code plugins…"
const LIST_NAME = /^(?:top\s+)?\d{1,2}\s+(?:[\w.+-]+\s+){0,4}(?:tools|apps|repos|repositories|skills|plugins|libraries|sites|websites|extensions|prompts|resources|agents|gpts|mcps|ai)\b/i;

function host(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function checkResult(r: JobResult, jobKind: string): Finding[] {
  const f: Finding[] = [];
  const err = (path: string, message: string) => f.push({ level: "error", path, message });
  const warn = (path: string, message: string) => f.push({ level: "warning", path, message });

  // Capture
  const cs = r.capture.summary?.trim() ?? "";
  if (cs.length < 30) err("capture.summary", "Write one full sentence (30+ characters) saying what this reel/link is about.");
  if (NON_LATIN.test(cs)) err("capture.summary", "Write the summary in English (Latin script), even if the reel is in Hindi.");
  if (jobKind === "reel" && !r.capture.creator_handle) warn("capture.creator_handle", "Copy the creator's Instagram handle from evidence.md.");
  if (jobKind === "link" && r.status !== "unresolved" && !r.capture.archived_content)
    warn("capture.archived_content", "Paste the page text from evidence.json (page_text) so the resource survives if the link dies.");

  // Status rules
  const primaries = r.entities.filter((e) => e.role === "primary");
  if (r.status !== "unresolved" && r.entities.length === 0) err("entities", `Status "${r.status}" needs at least one entity. Use status "unresolved" if you found nothing.`);
  if (r.entities.length && primaries.length !== 1) err("entities", `Exactly one entity must have role "primary" (found ${primaries.length}). Others are "mentioned" or "alternative".`);
  if (r.status === "ok" && r.confidence < 0.7) err("confidence", "Confidence is below 0.7: don't guess. Run `pnpm worker ask` with the candidate names instead.");
  if (r.status === "ok") {
    const p = primaries[0];
    if (p && !p.canonical_url && !p.is_creator_owned) err("entities[primary].canonical_url", 'Status "ok" needs the primary item\'s verified link (run `pnpm worker verify-url <url>`), or use status "pending_dm" / "unresolved".');
  }
  // List posts ("5 GitHub repos this week"): the list itself is not an item. The first tool listed is the primary.
  // Not for pasted guides (text jobs), uploaded documents (file jobs) or DM content that closes a to-do:
  // there the saved document is the item.
  const main = primaries[0];
  const savedDocument = jobKind === "text" || jobKind === "file";
  if (main && !main.canonical_url && r.status !== "pending_dm" && !savedDocument && !r.resolves_task_id) {
    const linked = r.entities.filter((e) => e !== main && e.canonical_url && e.link_verified);
    if (linked.length)
      err(
        "entities[primary]",
        `The primary item "${main.name}" has no link, but ${linked.map((e) => `"${e.name}"`).join(", ")} ${linked.length === 1 ? "has" : "have"} one. If the post lists several tools, don't save the list itself: make the first tool listed the primary and the rest "mentioned" (WORKER.md, Step 5).`,
      );
    else if (LIST_NAME.test(main.name))
      err("entities[primary].name", `"${main.name}" looks like a list, not one item. Save the first tool listed as the primary and the rest as "mentioned", each with its own verified link (WORKER.md, Step 5).`);
  }
  if (r.status === "pending_dm") {
    const owned = r.entities.find((e) => e.is_creator_owned && !e.canonical_url);
    if (!owned) err("entities", 'Status "pending_dm" needs an entity with is_creator_owned: true and no canonical_url (the link is still behind the DM).');
    else if (!owned.comment_keyword) warn("entities[].comment_keyword", 'Set comment_keyword to the word the reel asks people to comment (e.g. "SKILL").');
  }
  if (r.status === "unresolved" && r.confidence > 0.5 && r.entities.length) warn("status", 'You listed entities with decent confidence: should status be "ok"?');

  // Entities
  r.entities.forEach((e, i) => {
    const at = (k: string) => `entities[${i}] (${e.name}).${k}`;
    const isPrimary = e.role === "primary";
    if (e.summary.trim().length < 50) err(at("summary"), "Write 1–2 full sentences (50+ characters): what it is and what it does.");
    if (e.summary.trim().toLowerCase() === e.name.trim().toLowerCase()) err(at("summary"), "The summary must explain the item, not repeat its name.");
    if (NON_LATIN.test(e.summary) || NON_LATIN.test(e.name)) err(at("summary"), "Use English / Latin script for name and summary.");
    if (e.use_cases.length < (isPrimary ? 2 : 1)) err(at("use_cases"), `Add ${isPrimary ? "2–4" : "1–3"} short use cases, phrased as what someone wants to do ("make video ads from a product photo").`);
    const minTerms = isPrimary ? 10 : 5;
    if (e.search_terms.length < minTerms)
      err(at("search_terms"), `Add at least ${minTerms} search terms (have ${e.search_terms.length}): synonyms, the problems it solves in plain words, related concepts, likely misspellings.`);
    if (e.tags.length < 2 || e.tags.length > 8) err(at("tags"), "Use 2–8 tags. Run `pnpm worker tags` and reuse existing ones first.");
    const badTags = e.tags.filter((t) => !KEBAB.test(t));
    if (badTags.length) err(at("tags"), `Tags must be lowercase-kebab-case: ${badTags.join(", ")}`);
    if (e.category === "other") warn(at("category"), 'Category "other" is a last resort. Pick the closest real category.');
    if (e.canonical_url) {
      const h = host(e.canonical_url);
      if (!h) err(at("canonical_url"), "Not a valid URL.");
      else if (SHORTENERS.test(h)) err(at("canonical_url"), `${h} is a redirect/short/profile link, not the resource. Open it and use the final official URL.`);
      if (!e.link_verified) err(at("link_verified"), "You set a link but didn't verify it. Run `pnpm worker verify-url <url>`, check the page matches, then set link_verified: true.");
    }
    if (e.is_creator_owned && !e.creator_handle) warn(at("creator_handle"), "Creator-owned resources should carry the creator's handle.");
    if (e.kind === "repo" && e.canonical_url && host(e.canonical_url) !== "github.com" && host(e.canonical_url) !== "gitlab.com")
      warn(at("kind"), 'kind "repo" usually has a GitHub/GitLab URL. Is this a "tool" instead?');
  });

  if (r.resolves_task_id && !["link", "image", "text", "file"].includes(jobKind)) warn("resolves_task_id", "Only DM links/screenshots/documents usually resolve tasks.");
  return f;
}

export function formatFindings(f: Finding[]): string {
  return f.map((x) => `${x.level === "error" ? "✗ ERROR  " : "⚠ warning"} ${x.path}: ${x.message}`).join("\n");
}
