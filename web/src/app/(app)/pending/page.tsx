import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, EmptyState, EntityCard, ListSkeleton, PageHeader, Pagination, SectionTitle, btn } from "@/components/ui";
import { listEntities } from "@/lib/search";
import { closeDmWaitAction } from "@/app/actions";
import { currentMember, myOpenTasks } from "@/lib/ui-data";
import { creatorLink, fullDate, safeUrl, timeAgo } from "@/lib/ui-format";

export const metadata: Metadata = { title: "Waiting on DM links" };

const PAGE_SIZE = 20;

export default function PendingPage({ searchParams }: PageProps<"/pending">) {
  return (
    <>
      <PageHeader
        title="Waiting on DM links"
        description={
          <>
            Some creators only share their resource if you comment a keyword. Comment on the reel, then forward the DM link (or a screenshot) to the
            Orphic bot in Telegram and the item gets its real link.
          </>
        }
      />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Pending searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Pending({ searchParams }: { searchParams: PageProps<"/pending">["searchParams"] }) {
  const raw = await searchParams;
  const offset = Math.max(0, Number.parseInt(String(raw.offset ?? "0"), 10) || 0);
  const { member, now } = await currentMember();
  const [tasks, team] = await Promise.all([
    myOpenTasks(member.id),
    listEntities(member.workspace_id, { link_status: "pending_dm", limit: PAGE_SIZE, offset }),
  ]);

  return (
    <div className="space-y-10">
      <section aria-labelledby="mine">
        <SectionTitle aside={<span className="text-xs text-subtle">{tasks.length} open</span>}>
          <span id="mine">Your to-dos</span>
        </SectionTitle>
        {tasks.length === 0 ? (
          <EmptyState icon="🎉" title="Nothing waiting on you">
            When you save a reel that says &ldquo;comment X for the link&rdquo;, the to-do shows up here.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {tasks.map((t) => {
              const reel = safeUrl(t.source_url);
              const profile = creatorLink(t.creator_handle, [t.source_url])?.href;
              return (
                <li key={t.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-ink">
                          {t.entity_slug ? (
                            <Link href={`/tools/${t.entity_slug}`} className="hover:underline">
                              {t.entity_name}
                            </Link>
                          ) : (
                            (t.entity_name ?? "Creator resource")
                          )}
                        </p>
                        {t.kind === "comment_for_link" ? (
                          <p className="mt-1.5 text-sm text-ink">
                            Comment{" "}
                            {t.keyword ? (
                              <kbd className="rounded-md border border-line bg-sunken px-1.5 py-0.5 font-mono text-sm font-semibold">{t.keyword}</kbd>
                            ) : (
                              "the keyword"
                            )}{" "}
                            on {t.creator_handle ? <span className="font-medium">@{t.creator_handle}</span> : "the creator"}&apos;s reel, then forward
                            their DM to the bot.
                          </p>
                        ) : (
                          <p className="mt-1.5 text-sm text-ink">Orphic needs your answer in Telegram to finish this save.</p>
                        )}
                        {t.instructions && <p className="mt-1 text-sm text-subtle">{t.instructions}</p>}
                        {t.caption && <p className="mt-2 line-clamp-2 text-sm italic text-subtle">&ldquo;{t.caption}&rdquo;</p>}
                        <p className="mt-2 text-xs text-subtle">
                          Saved{" "}
                          <time dateTime={new Date(t.created_at).toISOString()} title={fullDate(t.created_at)}>
                            {timeAgo(t.created_at, now)}
                          </time>
                          {t.last_reminded_at && <> · last reminder {timeAgo(t.last_reminded_at, now)}</>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                        {reel && (
                          <a href={reel} target="_blank" rel="noopener noreferrer" className={btn.primary}>
                            Open reel <span aria-hidden="true">↗</span>
                          </a>
                        )}
                        {profile && (
                          <a href={profile} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
                            @{t.creator_handle}
                          </a>
                        )}
                        {t.entity_id && <NeverCameButton entityId={t.entity_id} />}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="team-pending">
        <SectionTitle>
          <span id="team-pending">Whole team: items waiting on a DM</span>
        </SectionTitle>
        {team.total === 0 ? (
          <EmptyState icon="✅" title="No items waiting">
            Every saved item has a link or doesn&apos;t need one.
          </EmptyState>
        ) : (
          <>
            <div className="mb-3">
              <Pagination total={team.total} offset={team.offset} count={team.items.length} limit={PAGE_SIZE} path="/pending" params={{}} />
            </div>
            <ul className="space-y-3">
              {team.items.map((item) => (
                <li key={item.id} className="space-y-2">
                  <EntityCard item={item} />
                  <div className="flex justify-end">
                    <NeverCameButton entityId={item.id} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Pagination total={team.total} offset={team.offset} count={team.items.length} limit={PAGE_SIZE} path="/pending" params={{}} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function NeverCameButton({ entityId }: { entityId: string }) {
  return (
    <form action={closeDmWaitAction}>
      <input type="hidden" name="entityId" value={entityId} />
      <button type="submit" className={btn.secondary} title="The creator's comment automation never sent the link. Stop waiting; the item stays searchable.">
        🚫 DM never came
      </button>
    </form>
  );
}
