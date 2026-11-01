import Link from "next/link";
import { Suspense } from "react";
import { LiveSearch } from "@/components/live-search";
import { FilterSheet } from "@/components/filter-sheet";
import { Avatar, Card, EmptyState, EntityCard, ListSkeleton, Pagination, SectionTitle, Skeleton, cx } from "@/components/ui";
import { facets, listEntities, recentSaves, searchEntities } from "@/lib/search";
import { currentMember } from "@/lib/ui-data";
import { KIND_ICON, humanize, timeAgo } from "@/lib/ui-format";

const PAGE_SIZE = 20;

type Params = { q?: string; category?: string; kind?: string; tag?: string; offset?: string };

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

function buildHref(base: Params, patch: Partial<Params>) {
  const merged: Params = { ...base, ...patch };
  delete merged.offset; // any filter change starts from page 1
  if ("offset" in patch && patch.offset) merged.offset = patch.offset;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `/app?${s}` : "/app";
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const raw = await searchParams;
  const p: Params = { q: one(raw.q), category: one(raw.category), kind: one(raw.kind), tag: one(raw.tag) };
  const offset = Math.max(0, Number.parseInt(one(raw.offset) ?? "0", 10) || 0);

  const { member, now } = await currentMember();
  const ws = member.workspace_id;
  const filters = { category: p.category, kind: p.kind, tag: p.tag, limit: PAGE_SIZE, offset };

  const [results, f, feed] = await Promise.all([
    p.q ? searchEntities(ws, p.q, filters) : listEntities(ws, filters),
    facets(ws),
    recentSaves(ws, 12),
  ]);
  const hasFilters = Boolean(p.category || p.kind || p.tag);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {p.q ? "Search the team's finds" : `Hi ${member.display_name.split(" ")[0]}, what are you looking for?`}
          </h1>
          <p className="mt-1.5 text-[15px] text-subtle">Tools, workflows and prompts your team saved from reels, with real links.</p>
        </div>

        <SearchBox defaultValue={p.q} hidden={{ category: p.category, kind: p.kind, tag: p.tag }} />

        {/* Filters on phones: a "Filters" button (bottom sheet) + the active filters as removable chips */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 sm:hidden">
          <FilterSheet activeCount={[p.category, p.kind, p.tag].filter(Boolean).length} clearHref={buildHref(p, { category: undefined, kind: undefined, tag: undefined })}>
            {f.categories.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Category</h3>
                <div className="flex flex-wrap gap-2">
                  {f.categories.map((c) => (
                    <Chip key={c.value} href={buildHref(p, { category: p.category === c.value ? undefined : c.value })} active={p.category === c.value} count={c.count}>
                      {humanize(c.value)}
                    </Chip>
                  ))}
                </div>
              </section>
            )}
            {f.kinds.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Kind</h3>
                <div className="flex flex-wrap gap-2">
                  {f.kinds.map((k) => (
                    <Chip key={k.value} href={buildHref(p, { kind: p.kind === k.value ? undefined : k.value })} active={p.kind === k.value} count={k.count}>
                      <span aria-hidden="true">{KIND_ICON[k.value] ?? KIND_ICON.other}</span> {humanize(k.value)}
                    </Chip>
                  ))}
                </div>
              </section>
            )}
            {f.tags.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Popular tags</h3>
                <div className="flex flex-wrap gap-2">
                  {f.tags.slice(0, 24).map((t) => (
                    <Chip key={t.value} href={buildHref(p, { tag: p.tag === t.value ? undefined : t.value })} active={p.tag === t.value} count={t.count}>
                      #{t.value}
                    </Chip>
                  ))}
                </div>
              </section>
            )}
          </FilterSheet>
          {p.category && (
            <Chip href={buildHref(p, { category: undefined })} active>
              {humanize(p.category)} <span aria-hidden="true">✕</span>
              <span className="sr-only">(remove category filter)</span>
            </Chip>
          )}
          {p.kind && (
            <Chip href={buildHref(p, { kind: undefined })} active>
              {humanize(p.kind)} <span aria-hidden="true">✕</span>
              <span className="sr-only">(remove kind filter)</span>
            </Chip>
          )}
          {p.tag && (
            <Chip href={buildHref(p, { tag: undefined })} active>
              #{p.tag} <span aria-hidden="true">✕</span>
              <span className="sr-only">(remove tag filter)</span>
            </Chip>
          )}
        </div>

        {/* Filters on larger screens: inline rows */}
        <div className="mt-4 hidden space-y-2.5 sm:block">
          {f.categories.length > 0 && (
            <FilterRow label="Category">
              <Chip href={buildHref(p, { category: undefined })} active={!p.category}>
                All
              </Chip>
              {f.categories.map((c) => (
                <Chip key={c.value} href={buildHref(p, { category: p.category === c.value ? undefined : c.value })} active={p.category === c.value} count={c.count}>
                  {humanize(c.value)}
                </Chip>
              ))}
            </FilterRow>
          )}
          {f.kinds.length > 0 && (
            <FilterRow label="Kind">
              <Chip href={buildHref(p, { kind: undefined })} active={!p.kind}>
                Any kind
              </Chip>
              {f.kinds.map((k) => (
                <Chip key={k.value} href={buildHref(p, { kind: p.kind === k.value ? undefined : k.value })} active={p.kind === k.value} count={k.count}>
                  <span aria-hidden="true">{KIND_ICON[k.value] ?? KIND_ICON.other}</span> {humanize(k.value)}
                </Chip>
              ))}
            </FilterRow>
          )}
          {p.tag && (
            <FilterRow label="Tag">
              <Chip href={buildHref(p, { tag: undefined })} active>
                #{p.tag} <span aria-hidden="true">✕</span>
                <span className="sr-only">(remove tag filter)</span>
              </Chip>
            </FilterRow>
          )}
        </div>

        {/* Results */}
        <section className="mt-8" aria-labelledby="results-title">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="results-title" className="text-sm font-semibold uppercase tracking-wider text-subtle">
              {p.q ? <>Results for &ldquo;{p.q}&rdquo;</> : hasFilters ? "Matching items" : "Everything the team saved"}
            </h2>
            <span className="text-xs text-subtle">{p.q ? "Best matches first" : "Most-saved first"}</span>
          </div>

          {results.items.length === 0 ? (
            <EmptyState icon={p.q ? "🔍" : "🌱"} title={p.q ? "No matches" : hasFilters ? "Nothing matches these filters" : "Nothing saved yet"}>
              {p.q || hasFilters ? (
                <>
                  Try fewer words or{" "}
                  <Link href="/app" className="font-medium text-accent underline underline-offset-4">
                    clear filters
                  </Link>
                  .
                </>
              ) : (
                "Share a reel with the Orphic bot in Telegram and it shows up here."
              )}
            </EmptyState>
          ) : (
            <>
              <div className="mb-3">
                <Pagination total={results.total} offset={results.offset} count={results.items.length} limit={PAGE_SIZE} path="/" params={p} />
              </div>
              <ul className="space-y-3">
                {results.items.map((item) => (
                  <li key={item.id}>
                    <EntityCard item={item} />
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Pagination total={results.total} offset={results.offset} count={results.items.length} limit={PAGE_SIZE} path="/" params={p} />
              </div>
            </>
          )}
        </section>
      </div>

      <aside className="space-y-8" aria-label="Team activity">
        <section>
          <SectionTitle>At a glance</SectionTitle>
          <dl className="grid grid-cols-3 gap-2">
            {[
              { label: "Items", value: f.totals.entities },
              { label: "Saves", value: f.totals.captures, hint: "Reels & links captured" },
              { label: "Teammates", value: f.totals.members },
            ].map((s) => (
              <Card key={s.label} className="px-3 py-3">
                <dt className="text-xs text-subtle" title={s.hint}>
                  {s.label}
                </dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{s.value}</dd>
              </Card>
            ))}
          </dl>
          {f.tags.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium text-subtle">Popular tags</p>
              <div className="flex flex-wrap gap-1.5">
                {f.tags.slice(0, 12).map((t) => (
                  <Link
                    key={t.value}
                    href={buildHref(p, { tag: t.value })}
                    className={cx(
                      "rounded-md px-1.5 py-0.5 text-xs transition",
                      p.tag === t.value ? "bg-accent text-accent-ink" : "bg-sunken text-subtle hover:text-ink",
                    )}
                  >
                    #{t.value} <span className="tabular-nums opacity-70">{t.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="feed-title">
          <SectionTitle>
            <span id="feed-title">Team feed</span>
          </SectionTitle>
          {feed.length === 0 ? (
            <p className="text-sm text-subtle">No saves yet.</p>
          ) : (
            <ol className="space-y-3">
              {feed.map((s) => (
                <li key={`${s.capture_id}-${s.member}-${s.saved_at}`} className="flex gap-2.5">
                  <Avatar name={s.member} size="sm" className="mt-0.5" />
                  <div className="min-w-0 text-sm">
                    <p className="text-ink">
                      <span className="font-medium">{s.member}</span> <span className="text-subtle">saved</span>{" "}
                      {s.entity_slug ? (
                        <Link href={`/tools/${s.entity_slug}`} className="font-medium underline decoration-line underline-offset-4 hover:decoration-accent">
                          {s.entity_name}
                        </Link>
                      ) : (
                        <span className="text-subtle">a {s.kind}</span>
                      )}
                      {s.status === "pending_dm" && (
                        <span className="ml-1" title="Waiting on DM link" aria-label="Waiting on DM link">
                          ⏳
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-subtle">
                      <time dateTime={new Date(s.saved_at).toISOString()}>{timeAgo(s.saved_at, now)}</time>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}

function SearchBox(_props: { defaultValue?: string; hidden?: Record<string, string | undefined> }) {
  return (
    <Suspense fallback={<div className="h-14 rounded-2xl border border-line bg-card" />}>
      <LiveSearch placeholder="e.g. make video ads from a product photo" />
    </Suspense>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1.5 w-16 shrink-0 text-xs font-medium text-subtle">{label}</span>
      <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">{children}</div>
    </div>
  );
}

function Chip({ href, active, count, children }: { href: string; active?: boolean; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-sm transition",
        active ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink hover:border-subtle/40 hover:bg-sunken",
      )}
    >
      {children}
      {count !== undefined && <span className={cx("text-xs tabular-nums", active ? "opacity-80" : "text-subtle")}>{count}</span>}
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <Skeleton className="mb-2 h-8 w-2/3" />
        <Skeleton className="mb-6 h-5 w-1/2" />
        <Skeleton className="h-14 rounded-2xl" />
        <Skeleton className="mt-4 mb-8 h-8 w-3/4" />
        <ListSkeleton />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
