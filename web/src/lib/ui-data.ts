// Small read helpers for the web UI (pages under src/app). Server-only.
import { cache } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { auth } from "./auth";
import { q, q1 } from "./db";
import { requireMember } from "./viewer";

/**
 * The signed-in teammate for this request (deduped per render).
 * `connection()` marks the caller as request-time, so reading the clock is allowed; `now` is that reading.
 */
export const currentMember = cache(async () => {
  await connection();
  const viewer = await requireMember();
  // One clock reading per request, so every "2h ago" on a page agrees.
  return { ...viewer, now: Date.now() };
});

/** The real Better Auth session user (ignores the dev bypass). Used by /connect so we never link a fake "dev" user. */
export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { id: session.user.id, email: session.user.email, name: session.user.name } : null;
}

export async function openTaskCount(memberId: string) {
  const row = await q1<{ n: string }>(`select count(*) as n from tasks where member_id = $1 and status = 'open'`, [memberId]);
  return Number(row?.n ?? 0);
}

export type OpenTask = {
  id: string;
  kind: "comment_for_link" | "needs_user";
  keyword: string | null;
  instructions: string | null;
  created_at: string;
  last_reminded_at: string | null;
  source_url: string | null;
  creator_handle: string | null;
  caption: string | null;
  entity_name: string | null;
  entity_slug: string | null;
  entity_id: string | null;
};

export async function myOpenTasks(memberId: string) {
  return q<OpenTask>(
    `select t.id, t.kind, t.keyword, t.instructions, t.created_at, t.last_reminded_at,
            c.source_url, coalesce(c.creator_handle, e.creator_handle) as creator_handle, left(c.caption, 280) as caption,
            e.name as entity_name, e.slug as entity_slug, t.entity_id
     from tasks t left join captures c on c.id = t.capture_id left join entities e on e.id = t.entity_id
     where t.member_id = $1 and t.status = 'open'
     order by t.created_at desc`,
    [memberId],
  );
}

export async function myRating(entityId: string, memberId: string) {
  const row = await q1<{ value: number }>(`select value from ratings where entity_id = $1 and member_id = $2`, [entityId, memberId]);
  return row ? Number(row.value) : 0;
}

/** Every save of an entity (any capture linked to it), with who and when. */
export async function entitySaves(entityId: string) {
  return q<{ member: string; saved_at: string; note: string | null }>(
    `select m.display_name as member, min(s.created_at) as saved_at, (array_agg(s.note order by s.created_at) filter (where s.note is not null))[1] as note
     from capture_entities ce join saves s on s.capture_id = ce.capture_id join members m on m.id = s.member_id
     where ce.entity_id = $1 group by m.id, m.display_name order by min(s.created_at)`,
    [entityId],
  );
}

export async function teamMembers(workspaceId: string) {
  return q<{
    id: string;
    display_name: string;
    telegram_username: string | null;
    email: string | null;
    role: "owner" | "admin" | "member";
    created_at: string;
    web_linked: boolean;
    saves: string;
    has_telegram: boolean;
  }>(
    `select m.id, m.display_name, m.telegram_username, m.email, m.role, m.created_at, (m.auth_user_id is not null) as web_linked, (m.telegram_user_id is not null) as has_telegram,
            (select count(*) from saves s where s.member_id = m.id) as saves
     from members m where m.workspace_id = $1 and m.disabled_at is null
     order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m.created_at`,
    [workspaceId],
  );
}

export async function myApiKeys(memberId: string) {
  return q<{ id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }>(
    `select id, name, prefix, created_at, last_used_at from api_keys
     where member_id = $1 and revoked_at is null order by created_at desc limit 20`,
    [memberId],
  );
}
