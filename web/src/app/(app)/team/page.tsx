import type { Metadata } from "next";
import { Suspense } from "react";
import { InviteForm } from "@/components/invite-form";
import { WebInviteForm } from "@/components/web-invite-form";
import { removeTeammate } from "@/app/actions";
import { Avatar, Card, ListSkeleton, PageHeader, SectionTitle, cx } from "@/components/ui";
import { currentMember, teamMembers } from "@/lib/ui-data";
import { plural } from "@/lib/ui-format";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <>
      <PageHeader title="Team" description="Everyone who saves to Orphic. Anyone can search everything the team has saved." />
      <Suspense fallback={<ListSkeleton rows={3} />}>
        <Team />
      </Suspense>
    </>
  );
}

const ROLE_STYLE: Record<string, string> = {
  owner: "bg-accent-soft text-accent-strong",
  admin: "bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  member: "bg-sunken text-subtle",
};

async function Team() {
  const { member } = await currentMember();
  const members = await teamMembers(member.workspace_id);
  const canInvite = member.role === "owner"; // only the owner can bring new people in
  const canRemove = member.role === "owner" || member.role === "admin";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="members">
        <SectionTitle aside={<span className="text-xs text-subtle">{plural(members.length, "member")}</span>}>
          <span id="members">Members</span>
        </SectionTitle>
        <Card className="divide-y divide-line">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3.5">
              <Avatar name={m.display_name} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">
                  {m.display_name}
                  {m.id === member.id && <span className="ml-1.5 text-xs font-normal text-subtle">(you)</span>}
                </p>
                <p className="truncate text-sm text-subtle">
                  {m.telegram_username ? (
                    <a href={`https://t.me/${m.telegram_username}`} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                      @{m.telegram_username}
                    </a>
                  ) : m.has_telegram ? (
                    "Telegram connected"
                  ) : (
                    "Web only"
                  )}
                  {m.web_linked ? <span title="Has a web login"> · web ✓</span> : !m.has_telegram && <span> · invite not used yet</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium capitalize", ROLE_STYLE[m.role])}>{m.role}</span>
                <span className="text-xs tabular-nums text-subtle">{plural(Number(m.saves), "save")}</span>
                {canRemove && m.id !== member.id && m.role !== "owner" && (
                  <form action={removeTeammate}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <button type="submit" className="text-xs text-rose-700 hover:underline dark:text-rose-400" title="Blocks their bot, web and API access. Their saves stay.">
                      Remove access
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </Card>
      </section>

      <aside>
        <SectionTitle>Invite a teammate</SectionTitle>
        <Card className="p-5">
          {canInvite ? (
            <>
              <p className="mb-4 text-sm text-subtle">
                Create a link and send it to a teammate. Opening it in Telegram starts a chat with the Orphic bot and adds them to this team. Then they can
                share reels straight from Instagram.
              </p>
              <InviteForm />
              <div className="mt-6 border-t border-line pt-5">
                <p className="mb-1 text-sm font-medium text-ink">Web only (no Telegram)</p>
                <p className="mb-3 text-sm text-subtle">For teammates who just want to search on the web. They get a private link to set their password.</p>
                <WebInviteForm />
              </div>
            </>
          ) : (
            <p className="text-sm text-subtle">Only the owner can invite new people. Ask them for a link.</p>
          )}
        </Card>
      </aside>
    </div>
  );
}
