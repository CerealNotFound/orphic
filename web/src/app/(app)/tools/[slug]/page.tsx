import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { rateEntity } from "@/app/actions";
import { Avatar, Card, KindIcon, LinkStatusBadge, SectionTitle, Skeleton, TagChip, btn, cx } from "@/components/ui";
import { getEntity } from "@/lib/search";
import { currentMember, entitySaves, myRating } from "@/lib/ui-data";
import { snapshotsForCaptures, type SnapshotMeta } from "@/lib/snapshots";
import { creatorLink, fullDate, humanize, platformName, plural, safeUrl, timeAgo } from "@/lib/ui-format";

export default function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Tool params={params} />
    </Suspense>
  );
}

async function Tool({ params }: { params: PageProps<"/tools/[slug]">["params"] }) {
  const { slug } = await params;
  const { member, now } = await currentMember();
  const entity = await getEntity(member.workspace_id, decodeURIComponent(slug));
  if (!entity) notFound();

  const [saves, myVote, copies] = await Promise.all([
    entitySaves(entity.id),
    myRating(entity.id, member.id),
    snapshotsForCaptures(member.workspace_id, entity.captures.map((c) => c.id)),
  ]);
  const url = safeUrl(entity.canonical_url);
  const ups = entity.ratings.filter((r) => Number(r.value) > 0).length;
  const downs = entity.ratings.filter((r) => Number(r.value) < 0).length;
  // Prefer posts by the item's own creator when working out which site they're on.
  const sources = [...entity.captures].sort((a, b) => Number(b.creator_handle === entity.creator_handle) - Number(a.creator_handle === entity.creator_handle));
  const creator = creatorLink(entity.creator_handle, sources.map((c) => c.source_url));

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-subtle">
        <Link href="/" className="hover:text-ink">
          Search
        </Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/?category=${encodeURIComponent(entity.category)}`} className="hover:text-ink">
          {humanize(entity.category)}
        </Link>
      </nav>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-8">
          {/* Header */}
          <header className="flex gap-4">
            <KindIcon kind={entity.kind} className="size-14 text-2xl" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{entity.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-subtle">
                <span>{humanize(entity.kind)}</span>
                <span aria-hidden="true">·</span>
                <Link href={`/?category=${encodeURIComponent(entity.category)}`} className="hover:text-ink">
                  {humanize(entity.category)}
                </Link>
                {entity.pricing && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{entity.pricing}</span>
                  </>
                )}
                <LinkStatusBadge status={entity.link_status} />
              </div>
            </div>
          </header>

          <div className="flex flex-wrap items-center gap-3">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className={btn.primary}>
                Open {entity.domain ?? "link"} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              <span className={cx(btn.secondary, "cursor-default")}>
                {entity.link_status === "pending_dm" ? "⏳ Link coming via creator's DM" : "No verified link yet"}
              </span>
            )}
            {creator ? (
              <a href={creator.href} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
                @{entity.creator_handle} on {creator.site} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              entity.creator_handle && <span className="text-sm text-subtle">by @{entity.creator_handle}</span>
            )}
          </div>

          {entity.summary && <p className="text-lg leading-relaxed text-ink">{entity.summary}</p>}

          {entity.use_cases.length > 0 && (
            <section aria-labelledby="uses">
              <SectionTitle>
                <span id="uses">Use it for</span>
              </SectionTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {entity.use_cases.map((u) => (
                  <li key={u} className="flex items-start gap-2 rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink">
                    <span aria-hidden="true" className="text-accent">
                      →
                    </span>
                    {u}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(entity.tags.length > 0 || entity.aliases.length > 0) && (
            <section className="space-y-3">
              {entity.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-xs font-medium text-subtle">Tags</span>
                  {entity.tags.map((t) => (
                    <TagChip key={t} tag={t} href={`/?tag=${encodeURIComponent(t)}`} />
                  ))}
                </div>
              )}
              {entity.aliases.length > 0 && (
                <p className="text-sm text-subtle">
                  <span className="text-xs font-medium">Also known as </span>
                  {entity.aliases.join(", ")}
                </p>
              )}
            </section>
          )}

          {entity.related.length > 0 && (
            <section aria-labelledby="related">
              <SectionTitle aside={<span className="text-xs text-subtle">{plural(entity.related.length, "item")}</span>}>
                <span id="related">From the same post</span>
              </SectionTitle>
              <ul className="grid gap-2 sm:grid-cols-2">
                {entity.related.map((r) => (
                  <li key={r.id}>
                    <Link href={`/tools/${r.slug}`} className="flex h-full items-start gap-3 rounded-xl border border-line bg-card px-3 py-2.5 hover:border-accent">
                      <KindIcon kind={r.kind} className="size-8 shrink-0 text-base" />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
                          {r.name}
                          <LinkStatusBadge status={r.link_status} />
                        </span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-subtle">{r.domain ?? r.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sources */}
          <section aria-labelledby="sources">
            <SectionTitle aside={<span className="text-xs text-subtle">{plural(entity.captures.length, "source")}</span>}>
              <span id="sources">Where it came from</span>
            </SectionTitle>
            {entity.captures.length === 0 ? (
              <p className="text-sm text-subtle">No source reels or links recorded.</p>
            ) : (
              <ul className="space-y-3">
                {entity.captures.map((c) => {
                  const src = safeUrl(c.source_url);
                  const site = platformName(src);
                  return (
                    <li key={c.id}>
                      <Card className="p-4">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="rounded-md bg-sunken px-1.5 py-0.5 text-xs font-medium capitalize text-subtle">{c.kind}</span>
                          {c.creator_handle && <span className="font-medium text-ink">@{c.creator_handle}</span>}
                          {c.role !== "primary" && <span className="text-xs text-subtle">({c.role})</span>}
                          {c.status === "pending_dm" && <LinkStatusBadge status="pending_dm" />}
                          <span className="ml-auto text-xs text-subtle">
                            <time dateTime={new Date(c.created_at).toISOString()} title={fullDate(c.created_at)}>
                              {timeAgo(c.created_at, now)}
                            </time>
                          </span>
                        </div>
                        {(c.caption || c.summary) && (
                          <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm text-subtle">{c.caption || c.summary}</p>
                        )}
                        {copies.some((x) => x.capture_id === c.id) && <SavedCopies copies={copies.filter((x) => x.capture_id === c.id)} />}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-subtle">{c.saved_by.length > 0 && <>Saved by {c.saved_by.join(", ")}</>}</span>
                          {src && (
                            <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent underline-offset-4 hover:underline">
                              {site ? `Open on ${site}` : "Open link"} <span aria-hidden="true">↗</span>
                            </a>
                          )}
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Tried it?</h2>
            <p className="mt-1 text-sm text-subtle">
              Team score{" "}
              <span className={cx("font-semibold tabular-nums", entity.rating_score > 0 ? "text-emerald-700 dark:text-emerald-400" : entity.rating_score < 0 ? "text-rose-700 dark:text-rose-400" : "text-ink")}>
                {entity.rating_score > 0 ? `+${entity.rating_score}` : entity.rating_score}
              </span>{" "}
              · {ups} 👍 · {downs} 👎
            </p>
            <form action={rateEntity} className="mt-4 grid grid-cols-2 gap-2">
              <input type="hidden" name="entityId" value={entity.id} />
              <RateButton value={1} active={myVote === 1} label="Works" icon="👍" />
              <RateButton value={-1} active={myVote === -1} label="Meh" icon="👎" />
            </form>
            <p className="mt-2 text-xs text-subtle" aria-live="polite">
              {myVote === 1 ? "You said it works. Tap again to undo." : myVote === -1 ? "You said meh. Tap again to undo." : "You haven't rated this yet."}
            </p>
            {entity.ratings.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
                {entity.ratings.map((r) => (
                  <li key={r.member} className="flex items-center gap-2 text-sm">
                    <Avatar name={r.member} size="sm" />
                    <span className="text-ink">{r.member}</span>
                    <span className="ml-auto" aria-label={Number(r.value) > 0 ? "works" : "meh"}>
                      {Number(r.value) > 0 ? "👍" : "👎"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Saved by {plural(saves.length || entity.save_count, "teammate")}</h2>
            {saves.length === 0 ? (
              <p className="mt-2 text-sm text-subtle">No saves recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {saves.map((s) => (
                  <li key={s.member} className="flex items-start gap-2.5">
                    <Avatar name={s.member} size="sm" className="mt-0.5" />
                    <div className="min-w-0 text-sm">
                      <p className="text-ink">{s.member}</p>
                      <p className="text-xs text-subtle">
                        <time dateTime={new Date(s.saved_at).toISOString()} title={fullDate(s.saved_at)}>
                          {timeAgo(s.saved_at, now)}
                        </time>
                        {s.note && <> · &ldquo;{s.note}&rdquo;</>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <dl className="space-y-2 px-1 text-sm">
            {entity.domain && <Row label="Domain" value={<span className="font-mono">{entity.domain}</span>} />}
            <Row label="Pricing" value={entity.pricing ? <span className="capitalize">{entity.pricing}</span> : "Unknown"} />
            <Row label="Updated" value={timeAgo(entity.updated_at, now)} />
          </dl>
        </aside>
      </div>
    </div>
  );
}

function SavedCopies({ copies }: { copies: SnapshotMeta[] }) {
  const main = copies.filter((x) => !x.part);
  const parts = copies.filter((x) => x.part);
  const label = (x: SnapshotMeta) =>
    x.content_type.startsWith("text/html")
      ? "🌐 Full copy"
      : x.kind === "text"
        ? "📝 Text"
        : x.content_type === "application/pdf"
          ? "📄 PDF"
          : x.content_type.startsWith("image/")
            ? "🖼 Image"
            : x.content_type.startsWith("video/")
              ? "🎬 Video"
              : x.content_type.startsWith("audio/")
                ? "🔊 Audio"
                : "📦 File";
  const size = (x: SnapshotMeta) => {
    const kb = Math.max(1, Math.round(Number(x.size_bytes) / 1024));
    return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
  };
  const chip = (x: SnapshotMeta) => (
    <li key={x.id}>
      <a
        href={`/api/snapshots/${x.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent"
        title={x.filename}
      >
        {label(x)}
        <span className="max-w-48 truncate font-normal text-subtle">{x.filename}</span>
        <span className="font-normal text-subtle">{size(x)}</span>
      </a>
    </li>
  );
  return (
    <div className="mt-3 rounded-xl bg-sunken p-3">
      <p className="text-xs font-medium text-subtle">
        🔒 Saved copies <span className="font-normal">(private to your team, kept even if the original link is taken down)</span>
      </p>
      {main.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{main.map(chip)}</ul>}
      {parts.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-subtle hover:text-ink">
            {plural(parts.length, "file")} inside this copy ({size({ size_bytes: String(parts.reduce((a, x) => a + Number(x.size_bytes), 0)) } as SnapshotMeta)})
          </summary>
          <ul className="mt-2 flex flex-wrap gap-2">{parts.map(chip)}</ul>
        </details>
      )}
    </div>
  );
}

function RateButton({ value, active, label, icon }: { value: 1 | -1; active: boolean; label: string; icon: string }) {
  return (
    <button
      type="submit"
      name="value"
      value={value}
      aria-pressed={active}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
        active
          ? value > 0
            ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
            : "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200"
          : "border-line bg-card text-ink hover:bg-sunken",
      )}
    >
      <span aria-hidden="true">{icon}</span> {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_320px]" aria-busy="true">
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-2/3" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
