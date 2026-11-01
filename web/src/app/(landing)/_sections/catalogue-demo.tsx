"use client";
// The open catalogue. The page brings every entry (details included), so search, filters, scrolling and the
// details panel all run in the browser: no API calls, nothing to wait for.
import { useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics";
import { buildIndex, searchCatalogue } from "@/lib/catalogue-search";
import type { CatalogueEntry } from "@/lib/public-catalogue";
import { RevealScope } from "./reveal";
import "./catalogue-demo.css";

const ACRONYMS = new Set(["ai", "ui", "mcp", "ux", "api", "seo", "llm", "3d", "crm"]);
function humanize(v: string) {
  return v
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w, i) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : i === 0 ? w[0]?.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

const TEASER_ROWS = 8;
const noSubscribe = () => () => {};
const PAGE = 24;

/**
 * `teaser` (landing page): search + the top results + a link into the full catalogue.
 * `full` (/explore): every result, rendered in steps as you scroll; the URL follows the search so it can be shared.
 */
export function CatalogueDemo({
  entries,
  categories,
  placeholders,
  variant = "teaser",
  initialQuery = "",
  initialCategory = "",
}: {
  entries: CatalogueEntry[];
  categories: { value: string; count: number }[];
  placeholders: string[];
  variant?: "teaser" | "full";
  initialQuery?: string;
  initialCategory?: string;
}) {
  const full = variant === "full";
  // /explore is prerendered, so a shared ?q= / ?category= link is read from the address in the browser.
  // Until someone types or picks a category, the address decides; after that, their own choice does.
  const fromUrl = useSyncExternalStore(noSubscribe, () => (full ? window.location.search : ""), () => "");
  const urlParams = useMemo(() => new URLSearchParams(fromUrl), [fromUrl]);
  const [typed, setQuery] = useState<string | null>(null);
  const [picked, setCat] = useState<string | null>(null);
  const query = typed ?? ((urlParams.get("q") ?? initialQuery).slice(0, 200));
  const urlCat = urlParams.get("category") ?? initialCategory;
  const cat = picked ?? (categories.some((c) => c.value === urlCat) ? urlCat : "");
  const [limit, setLimit] = useState(full ? PAGE : TEASER_ROWS);
  const [phIdx, setPhIdx] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildIndex(entries), [entries]);
  const bySlug = useMemo(() => new Map(entries.map((e) => [e.slug, e])), [entries]);
  const q = useDeferredValue(query);
  const results = useMemo(() => searchCatalogue(index, q, cat), [index, q, cat]);
  const total = results.length;
  const visible = results.slice(0, limit);

  useEffect(() => {
    if (full && window.location.hash === "#search") inputRef.current?.focus();
  }, [full]);

  // Rotating placeholder: real searches from the catalogue.
  useEffect(() => {
    if (placeholders.length < 2) return;
    const t = setInterval(() => setPhIdx((i) => (i + 1) % placeholders.length), 2600);
    return () => clearInterval(t);
  }, [placeholders.length]);

  // New search: back to the top of the list. /explore also keeps the address in sync (shareable, no navigation).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setLimit(full ? PAGE : TEASER_ROWS);
    if (!full) return;
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (cat) sp.set("category", cat);
    window.history.replaceState(null, "", sp.size ? `/explore?${sp}` : "/explore");
  }, [q, cat, full]);

  // What people look for: one event once they stop typing (not one per keystroke).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const t = setTimeout(() => track("catalogue_search", { query: term, results: total, category: cat || null, page: full ? "explore" : "landing" }), 900);
    return () => clearTimeout(t);
  }, [q, cat, total, full]);

  // Render more rows as the end of the list comes near (the data is already here).
  useEffect(() => {
    const el = sentinel.current;
    if (!full || !el || limit >= total) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((n) => n + PAGE * 2), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [full, limit, total]);

  const pills = categories.slice(0, 8);
  const allCount = entries.length;
  const label = q.trim() ? ` for “${q.trim()}”` : cat ? ` in ${humanize(cat)}` : "";
  const shown = visible.length;
  const exploreHref = (() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (cat) sp.set("category", cat);
    return sp.size ? `/explore?${sp}` : "/explore";
  })();

  return (
    <section className="cd-section" aria-labelledby="cd-title">
      <div className="lp-wrap">
        {/* Landing teaser only: a quick, quiet rise for the header. /explore is a tool, so it stays still. */}
        <RevealScope className="contents">
          <p className="lp-label" {...(full ? {} : { "data-rv": "rise" })}>{full ? "The open catalogue" : "The catalogue"}</p>
          {full ? (
            <h1 id="cd-title" className="lp-display cd-title">
              Every AI tool from every reel.
            </h1>
          ) : (
            <h2 id="cd-title" className="lp-display cd-title" data-rv="rise" style={{ ["--rv-i" as string]: 1 }}>
              Every tool, findable in your own words.
            </h2>
          )}
          <p className="cd-sub" {...(full ? {} : { "data-rv": "rise", style: { ["--rv-i" as string]: 2 } })}>
            {allCount} tools found so far. Search them now: it&rsquo;s free, and nothing is behind a login.
          </p>
        </RevealScope>

        <div className="cd-grid">
          <div className="cd-search">
            <div className="cd-field">
              <svg className="cd-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="9" cy="9" r="5.5" />
                <path d="m13.2 13.2 4 4" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                id="search"
                className="cd-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  // Tab fills in the suggestion that's showing
                  if (e.key === "Tab" && !query && placeholders.length) {
                    e.preventDefault();
                    setQuery(placeholders[phIdx % placeholders.length]);
                  }
                }}
                aria-label="Search the catalogue"
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
              />
              {!query && placeholders.length > 0 && (
                <div className="cd-ph" aria-hidden="true">
                  <span key={phIdx}>
                    {placeholders[phIdx % placeholders.length]}
                    <kbd className="cd-tab">tab</kbd>
                  </span>
                </div>
              )}
            </div>
            <div className="cd-pills" role="group" aria-label="Filter by category">
              <button type="button" className="cd-pill" aria-pressed={cat === ""} onClick={() => setCat("")}>
                All <small>{allCount}</small>
              </button>
              {pills.map((c) => (
                <button key={c.value} type="button" className="cd-pill" aria-pressed={cat === c.value} onClick={() => (setCat(cat === c.value ? "" : c.value), track("catalogue_filter", { category: c.value }))}>
                  {humanize(c.value)} <small>{c.count}</small>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="cd-count" aria-live="polite">
          {total === 0 ? `0 results${label}` : shown < total && !full ? `Showing ${shown} of ${total}${label}` : `${total} result${total === 1 ? "" : "s"}${label}`}
        </p>

        {total === 0 ? (
          <p className="cd-empty">
            Nothing for &ldquo;{q.trim() || humanize(cat)}&rdquo; yet. Try{" "}
            <button type="button" className="cd-sug" onClick={() => (setQuery("video ads"), setCat(""))}>
              &ldquo;video ads&rdquo;
            </button>{" "}
            or{" "}
            <button type="button" className="cd-sug" onClick={() => (setQuery("claude skills"), setCat(""))}>
              &ldquo;claude skills&rdquo;
            </button>
            .
          </p>
        ) : (
          <>
            <ul className="cd-list">
              {visible.map((it, i) => (
                <Row key={it.slug} it={it} i={i} bySlug={bySlug} />
              ))}
            </ul>
            {!full && total > shown && (
              <div className="cd-more">
                <a href={exploreHref} className="lp-btn">
                  Browse all {total}
                  {label}
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            )}
            {full && shown < total && <div ref={sentinel} className="cd-more" aria-hidden="true" />}
          </>
        )}
      </div>
    </section>
  );
}

const KIND: Record<string, string> = { tool: "Tool", repo: "Repo", prompt: "Prompts", template: "Template", workflow: "Workflow", course: "Course", resource: "Guide", other: "Resource" };

/**
 * A result. The tool's name opens the tool itself; anywhere else on the row opens its page in the catalogue.
 * The chevron shows the details in place.
 */
function Row({ it, i, bySlug }: { it: CatalogueEntry; i: number; bySlug: Map<string, CatalogueEntry> }) {
  const [open, setOpen] = useState(false);
  const hasDetail = it.useCases.length > 0 || it.sources.length > 0 || it.related.length > 0;
  const copy = it.href !== it.url; // opens our saved copy (the original can be taken down)
  return (
    <li className="cd-li" style={{ ["--i" as string]: Math.min(i % PAGE, 8) }} data-open={open}>
      <div className="cd-item">
        <div className="cd-row">
          <Link href={`/explore/${it.slug}`} className="cd-cover" aria-label={`${it.name}: more about it`} />
          <svg className="cd-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="cd-main">
            <span className="cd-head">
              <a
                className="cd-name"
                href={it.href}
                {...(copy ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                onClick={() => track("tool_opened", { slug: it.slug, name: it.name, saved_copy: copy, from: "catalogue" })} title={copy ? "Open the saved copy" : `Open ${it.domain ?? "the tool"}`}>
                {it.name}
                <svg className="cd-ext" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 11l6-6M6 5h5v5" />
                </svg>
              </a>
              {it.domain && <span className="cd-domain">{copy ? `saved copy · ${it.domain}` : it.domain}</span>}
              <span className="cd-badge">{KIND[it.kind] ?? "Resource"}</span>
            </span>
            <span className="cd-sum">{it.summary}</span>
          </span>
          <span className="cd-cat">{humanize(it.category)}</span>
        </div>
        {hasDetail && (
          <button
            type="button"
            className="cd-expand"
            aria-expanded={open}
            aria-controls={`cd-d-${it.slug}`}
            aria-label={open ? `Hide details for ${it.name}` : `Show details for ${it.name}`}
            onClick={() => {
              if (!open) track("tool_details_opened", { slug: it.slug });
              setOpen((o) => !o);
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
        )}
      </div>
      {hasDetail && (
        <div className="cd-detail" id={`cd-d-${it.slug}`} role="region" aria-label={`${it.name} details`} inert={!open}>
          <div className="cd-detail-in">
            <Detail it={it} bySlug={bySlug} />
          </div>
        </div>
      )}
    </li>
  );
}

/** Details: what it's for, what else was in the same post, and who posted it. One column each, full width. */
function Detail({ it, bySlug }: { it: CatalogueEntry; bySlug: Map<string, CatalogueEntry> }) {
  const related = it.related.map((s) => bySlug.get(s)).filter((r): r is CatalogueEntry => !!r);
  return (
    <div className="cd-d">
      {it.useCases.length > 0 && (
        <div className="cd-d-col cd-d-col--uses">
          <p className="cd-d-k">Use it for</p>
          <ul className="cd-d-uses">
            {it.useCases.slice(0, 5).map((u) => (
              <li key={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</li>
            ))}
          </ul>
        </div>
      )}
      {related.length > 0 && (
        <div className="cd-d-col">
          <p className="cd-d-k">In the same post</p>
          <ul className="cd-d-rel">
            {related.slice(0, 5).map((r) => (
              <li key={r.slug}>
                <Link href={`/explore/${r.slug}`}>{r.name}</Link>
              </li>
            ))}
            {related.length > 5 && <li className="cd-d-more">+{related.length - 5} more</li>}
          </ul>
        </div>
      )}
      {it.sources.length > 0 && (
        <div className="cd-d-col">
          <p className="cd-d-k">Found in</p>
          <ul className="cd-d-rel">
            {it.sources.slice(0, 3).map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow">
                  {s.creator ? `@${s.creator.replace(/^@/, "")}` : `${s.platform} post`}
                  <span className="cd-d-plat"> · {s.platform} ↗</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
