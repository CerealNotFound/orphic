// Tiny shared UI pieces (Server Components; no client JS).
import Link from "next/link";
import type { ReactNode } from "react";
import type { EntityHit } from "@/lib/search";
import { KIND_ICON, humanize, initials, plural, safeUrl } from "@/lib/ui-format";

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-subtle transition hover:bg-sunken hover:text-ink",
};

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-card", className)}>{children}</div>;
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-subtle">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-subtle">{children}</h2>
      {aside}
    </div>
  );
}

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
];

function colorFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dim = size === "sm" ? "size-6 text-[10px]" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs";
  return (
    <span
      title={name}
      aria-hidden="true"
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-card", dim, colorFor(name), className)}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="flex items-center -space-x-1.5" aria-label={`Saved by ${names.join(", ")}`} role="img">
      {shown.map((n) => (
        <Avatar key={n} name={n} size="sm" />
      ))}
      {rest > 0 && (
        <span aria-hidden="true" className="inline-flex size-6 items-center justify-center rounded-full bg-sunken text-[10px] font-semibold text-subtle ring-2 ring-card">
          +{rest}
        </span>
      )}
    </span>
  );
}

const LINK_STATUS: Record<string, { label: string; icon: string; cls: string }> = {
  verified: { label: "Verified link", icon: "✅", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-900" },
  pending_dm: { label: "Waiting on DM", icon: "⏳", cls: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-900" },
  unverified: { label: "Unverified link", icon: "❓", cls: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-800" },
  saved: { label: "Saved in Orphic", icon: "📦", cls: "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-900" },
  unavailable: { label: "DM never came", icon: "🚫", cls: "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:ring-rose-900" },
  none: { label: "No link yet", icon: "–", cls: "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:ring-stone-800" },
};

export function LinkStatusBadge({ status }: { status: string }) {
  const s = LINK_STATUS[status] ?? LINK_STATUS.unverified;
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", s.cls)}>
      <span aria-hidden="true">{s.icon}</span>
      {s.label}
    </span>
  );
}

export function TagChip({ tag, href }: { tag: string; href?: string }) {
  const cls = "inline-flex items-center rounded-md bg-sunken px-1.5 py-0.5 text-xs text-subtle";
  return href ? (
    <Link href={href} className={cx(cls, "hover:text-ink")}>
      #{tag}
    </Link>
  ) : (
    <span className={cls}>#{tag}</span>
  );
}

export function Score({ value }: { value: number }) {
  const tone = value > 0 ? "text-emerald-700 dark:text-emerald-400" : value < 0 ? "text-rose-700 dark:text-rose-400" : "text-subtle";
  return (
    <span className={cx("inline-flex items-center gap-1 text-xs font-medium tabular-nums", tone)} title="Team rating (👍 minus 👎)">
      <span aria-hidden="true">👍</span>
      <span className="sr-only">Team score</span>
      {value > 0 ? `+${value}` : value}
    </span>
  );
}

export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      title={humanize(kind)}
      className={cx("inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-lg", className)}
    >
      {KIND_ICON[kind] ?? KIND_ICON.other}
    </span>
  );
}

export function EntityCard({ item }: { item: EntityHit }) {
  const url = safeUrl(item.canonical_url);
  return (
    <article className="group relative rounded-2xl border border-line bg-card p-4 transition hover:border-accent/40 hover:shadow-sm sm:p-5">
      <div className="flex gap-3.5">
        <KindIcon kind={item.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-base font-semibold leading-snug text-ink">
              <Link href={`/tools/${item.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none">
                {item.name}
              </Link>
            </h3>
            <span className="text-xs text-subtle">
              {humanize(item.kind)} · {humanize(item.category)}
            </span>
          </div>
          {item.summary && <p className="mt-1 line-clamp-2 text-sm text-subtle">{item.summary}</p>}
          {item.use_cases.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Use cases">
              {item.use_cases.slice(0, 3).map((u) => (
                <li key={u} className="rounded-md bg-accent-soft px-2 py-0.5 text-xs text-accent-strong">
                  {u}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            {url && item.domain ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 font-mono text-xs text-ink underline decoration-line underline-offset-4 hover:decoration-accent"
              >
                {item.domain} <span aria-hidden="true">↗</span>
              </a>
            ) : item.creator_handle ? (
              <span className="font-mono text-xs text-subtle">@{item.creator_handle}</span>
            ) : null}
            <LinkStatusBadge status={item.link_status} />
            {item.tags.slice(0, 4).map((t) => (
              <span key={t} className="relative z-10">
                <TagChip tag={t} href={`/app?tag=${encodeURIComponent(t)}`} />
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
            {item.savers.length > 0 && <AvatarStack names={item.savers} />}
            <span className="text-xs text-subtle">{plural(item.save_count, "save")}</span>
            <span className="ml-auto">
              <Score value={item.rating_score} />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

/** "Showing 1–20 of 57" plus Prev/Next links. Always shown so a page is never mistaken for everything. */
export function Pagination({
  total,
  offset,
  count,
  limit,
  path,
  params,
}: {
  total: number;
  offset: number;
  count: number;
  limit: number;
  path: string;
  params: Record<string, string | undefined>;
}) {
  const href = (o: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (o > 0) sp.set("offset", String(o));
    const s = sp.toString();
    return s ? `${path}?${s}` : path;
  };
  const prev = offset > 0 ? Math.max(0, offset - limit) : null;
  const next = offset + count < total ? offset + count : null;
  const pill = "inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-sm font-medium";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <p className="text-sm text-subtle" aria-live="polite">
        {total === 0 ? (
          "No results"
        ) : count === 0 ? (
          <>Nothing on this page · {total} total</>
        ) : (
          <>
            Showing <span className="font-medium text-ink tabular-nums">{offset + 1}–{offset + count}</span> of{" "}
            <span className="font-medium text-ink tabular-nums">{total}</span>
          </>
        )}
      </p>
      {(prev !== null || next !== null) && (
        <div className="flex gap-2">
          {prev !== null ? (
            <Link href={href(prev)} className={cx(pill, "bg-card text-ink hover:bg-sunken")} rel="prev">
              ← Prev
            </Link>
          ) : (
            <span className={cx(pill, "text-subtle opacity-50")} aria-disabled="true">
              ← Prev
            </span>
          )}
          {next !== null ? (
            <Link href={href(next)} className={cx(pill, "bg-card text-ink hover:bg-sunken")} rel="next">
              Next →
            </Link>
          ) : (
            <span className={cx(pill, "text-subtle opacity-50")} aria-disabled="true">
              Next →
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="text-3xl" aria-hidden="true">
        {icon}
      </div>
      <p className="mt-3 font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-subtle">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-sunken", className)} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight text-ink", className)}>
      <svg viewBox="0 0 64 64" className="size-7 text-accent" aria-hidden="true">
        {/* Orpheus' lyre */}
        <g fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round">
          <path d="M21 45 C 9.5 36, 8 22, 15 12.5 C 17 10, 20.5 10.5, 20 14" />
          <path d="M43 45 C 54.5 36, 56 22, 49 12.5 C 47 10, 43.5 10.5, 44 14" />
          <path d="M12.5 19 H 51.5" />
          <path d="M18 43.5 Q 18 55.5 32 55.5 Q 46 55.5 46 43.5 Z" fill="currentColor" strokeLinejoin="round" />
          <g strokeWidth="2.4">
            <path d="M26 19 V 44" />
            <path d="M30 19 V 44" />
            <path d="M34 19 V 44" />
            <path d="M38 19 V 44" />
          </g>
        </g>
      </svg>
      Orphic
    </span>
  );
}
