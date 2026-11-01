import { randomBytes } from "node:crypto";
import { q, q1, tx } from "./db";
import { slugify } from "./text";

export type Member = {
  id: string;
  workspace_id: string;
  display_name: string;
  email: string | null;
  telegram_user_id: string | null;
  telegram_username: string | null;
  role: "owner" | "admin" | "member";
  disabled_at?: string | null;
};

export async function memberByTelegramId(telegramUserId: number): Promise<Member | null> {
  return q1<Member>(`select * from members where telegram_user_id = $1 and disabled_at is null`, [telegramUserId]);
}

export async function memberByEmail(email: string): Promise<Member | null> {
  return q1<Member>(`select * from members where lower(email) = lower($1) order by created_at limit 1`, [email]);
}

export async function createWorkspace(name: string) {
  const ws = await q1<{ id: string; slug: string }>(
    `insert into workspaces (name, slug) values ($1, $2) returning id, slug`,
    [name, `${slugify(name)}-${randomBytes(2).toString("hex")}`],
  );
  return ws!;
}

export async function createInvite(workspaceId: string, opts: { role?: "admin" | "member"; maxUses?: number; createdBy?: string | null } = {}) {
  const code = randomBytes(9).toString("base64url");
  await q(`insert into invites (code, workspace_id, role, max_uses, created_by) values ($1, $2, $3, $4, $5)`, [
    code,
    workspaceId,
    opts.role ?? "member",
    opts.maxUses ?? 50,
    opts.createdBy ?? null,
  ]);
  return code;
}

/** Redeems an invite for a Telegram user. The first person in a workspace becomes its owner. */
export async function redeemInvite(
  code: string,
  tg: { id: number; username?: string; firstName: string; lastName?: string },
): Promise<{ member: Member; created: boolean } | { error: string }> {
  return tx(async (c) => {
    const inv = (
      await c.query(
        `select * from invites where code = $1 and uses < max_uses and (expires_at is null or expires_at > now()) for update`,
        [code],
      )
    ).rows[0];
    if (!inv) return { error: "That invite link is invalid or expired. Ask a teammate for a fresh one." };

    const existing = (await c.query<Member>(`select * from members where telegram_user_id = $1`, [tg.id])).rows[0];
    if (existing?.disabled_at) return { error: "Your access to this Orphic team was removed. Ask an admin if that's a mistake." };
    if (existing) return { member: existing, created: false };

    const count = Number((await c.query(`select count(*) from members where workspace_id = $1`, [inv.workspace_id])).rows[0].count);
    const role = count === 0 ? "owner" : inv.role;
    const name = [tg.firstName, tg.lastName].filter(Boolean).join(" ");
    const member = (
      await c.query<Member>(
        `insert into members (workspace_id, display_name, telegram_user_id, telegram_username, role)
         values ($1, $2, $3, $4, $5) returning *`,
        [inv.workspace_id, name, tg.id, tg.username ?? null, role],
      )
    ).rows[0];
    await c.query(`update invites set uses = uses + 1 where code = $1`, [code]);
    return { member, created: true };
  });
}

export async function workspaceGroupChat(workspaceId: string): Promise<number | null> {
  const row = await q1<{ telegram_group_chat_id: string | null }>(`select telegram_group_chat_id from workspaces where id = $1`, [workspaceId]);
  return row?.telegram_group_chat_id ? Number(row.telegram_group_chat_id) : null;
}
