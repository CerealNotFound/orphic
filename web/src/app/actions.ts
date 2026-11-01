"use server";
// Server Actions for the web UI. Each one re-checks who is calling; never trust form fields for identity.
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { q, q1 } from "@/lib/db";
import { env } from "@/lib/env";
import { createApiKey } from "@/lib/keys";
import { createLinkToken, peekLinkToken, redeemLinkToken } from "@/lib/link-tokens";
import { createInvite } from "@/lib/members";
import { closeDmWait } from "@/lib/pending";
import { getSessionUser } from "@/lib/ui-data";
import { requireMember } from "@/lib/viewer";

/** 👍 / 👎 an item. Clicking your current vote again clears it. */
export async function rateEntity(formData: FormData) {
  const { member } = await requireMember();
  const entityId = String(formData.get("entityId") ?? "");
  const value = Number(formData.get("value"));
  if (value !== 1 && value !== -1) return;

  const entity = await q1<{ id: string }>(`select id from entities where id = $1 and workspace_id = $2`, [entityId, member.workspace_id]);
  if (!entity) return;

  const current = await q1<{ value: number }>(`select value from ratings where entity_id = $1 and member_id = $2`, [entity.id, member.id]);
  if (current && Number(current.value) === value) {
    await q(`delete from ratings where entity_id = $1 and member_id = $2`, [entity.id, member.id]);
  } else {
    await q(
      `insert into ratings (entity_id, member_id, workspace_id, value) values ($1, $2, $3, $4)
       on conflict (entity_id, member_id) do update set value = excluded.value, created_at = now()`,
      [entity.id, member.id, member.workspace_id, value],
    );
  }
  await q(`update entities set rating_score = (select coalesce(sum(value), 0) from ratings where entity_id = $1) where id = $1`, [entity.id]);
  refresh();
}

/** The creator's comment automation never sent the link: stop waiting on it. */
export async function closeDmWaitAction(formData: FormData) {
  const { member } = await requireMember();
  await closeDmWait(member.workspace_id, String(formData.get("entityId") ?? ""));
  refresh();
}

export type WebInviteState = { link?: string; name?: string; error?: string } | null;

/** Owner only: add a teammate who'll use only the web app (no Telegram). Returns a 7-day, one-time link to set their password. */
export async function addWebTeammate(_prev: WebInviteState, formData: FormData): Promise<WebInviteState> {
  const { member } = await requireMember();
  if (member.role !== "owner") return { error: "Only the owner can add teammates." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!name) return { error: "Enter their name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  const existing = await q1<{ id: string; auth_user_id: string | null; disabled_at: string | null }>(
    `select id, auth_user_id, disabled_at from members where workspace_id = $1 and lower(email) = $2`,
    [member.workspace_id, email],
  );
  if (existing?.auth_user_id && !existing.disabled_at) return { error: "That person already has a login. They can sign in on the sign-in page." };
  const target =
    existing ??
    (await q1<{ id: string }>(`insert into members (workspace_id, display_name, email, role) values ($1, $2, $3, 'member') returning id`, [
      member.workspace_id,
      name,
      email,
    ]))!;
  if (existing?.disabled_at) await q(`update members set disabled_at = null, display_name = $2 where id = $1`, [existing.id, name]);
  const token = await createLinkToken(target.id, 7 * 24 * 60);
  refresh();
  return { link: `${env.APP_URL}/connect?token=${token}`, name };
}

/** Owner/admin: remove someone's access. Their saves stay; their bot access, web sessions and API keys stop working. */
export async function removeTeammate(formData: FormData) {
  const { member } = await requireMember();
  if (member.role !== "owner" && member.role !== "admin") return;
  const targetId = String(formData.get("memberId") ?? "");
  const target = await q1<{ id: string; role: string; auth_user_id: string | null }>(
    `select id, role, auth_user_id from members where id = $1 and workspace_id = $2 and disabled_at is null`,
    [targetId, member.workspace_id],
  );
  if (!target || target.id === member.id || target.role === "owner") return;
  await q(`update members set disabled_at = now() where id = $1`, [target.id]);
  await q(`update api_keys set revoked_at = now() where member_id = $1 and revoked_at is null`, [target.id]);
  if (target.auth_user_id) await q(`delete from "session" where "userId" = $1`, [target.auth_user_id]);
  refresh();
}

/** Revoke one of your own API keys (it stops working immediately). Owners/admins can revoke any key in the team. */
export async function revokeApiKey(formData: FormData) {
  const { member } = await requireMember();
  const keyId = String(formData.get("keyId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(keyId)) return;
  const isAdmin = member.role === "owner" || member.role === "admin";
  await q(
    `update api_keys set revoked_at = now()
     where id = $1 and workspace_id = $2 and revoked_at is null and member_id is not null and ($3 or member_id = $4)`,
    [keyId, member.workspace_id, isAdmin, member.id],
  );
  refresh();
}

export type InviteState = { link?: string; code?: string; error?: string } | null;

export async function createInviteLink(): Promise<InviteState> {
  const { member } = await requireMember();
  if (member.role !== "owner") return { error: "Only the owner can create invite links." };
  const code = await createInvite(member.workspace_id, { createdBy: member.id });
  const bot = env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  return bot ? { link: `https://t.me/${bot}?start=${code}`, code } : { code };
}

export type ApiKeyState = { key?: string; error?: string } | null;

export async function createMyApiKey(_prev: ApiKeyState, formData: FormData): Promise<ApiKeyState> {
  const { member } = await requireMember();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || `${member.display_name}'s key`;
  const key = await createApiKey({ workspaceId: member.workspace_id, memberId: member.id, name, scopes: ["read", "write"] });
  refresh();
  return { key };
}

export type PasswordAccountState = { error?: string } | null;

/** From a /web connect link: create an email + password login for this teammate and sign them in. */
export async function createPasswordAccount(_prev: PasswordAccountState, formData: FormData): Promise<PasswordAccountState> {
  const token = String(formData.get("token") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const link = await peekLinkToken(token);
  if (!link) return { error: "This link has expired. Send /web to the Orphic bot again." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  let userId: string;
  try {
    const res = await auth.api.signUpEmail({ body: { email, password, name: link.display_name }, headers: await headers() });
    userId = res.user.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/exist/i.test(msg)) return { error: "That email already has an Orphic login. Sign in with it below instead." };
    return { error: "Couldn't create the login. Please try again." };
  }
  if (!(await redeemLinkToken(token, userId, email))) return { error: "This link has expired. Send /web to the Orphic bot again." };
  redirect("/");
}

/**
 * From a /web connect link: set a new password for a teammate who already has a login (forgot password).
 * The link itself is the proof: only their Telegram account can get one, it works once and for 30 minutes.
 * All their other sessions are signed out.
 */
export async function resetPasswordWithLink(_prev: PasswordAccountState, formData: FormData): Promise<PasswordAccountState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const link = await peekLinkToken(token);
  if (!link?.auth_user_id || !link.login_email) return { error: "This link has expired. Send /web to the Orphic bot again." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (password.length > 128) return { error: "That password is too long (128 characters max)." };
  // Use the link up first, so it can't be used twice.
  if (!(await redeemLinkToken(token, link.auth_user_id, link.login_email))) return { error: "This link has expired. Send /web to the Orphic bot again." };
  try {
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(password);
    if (await ctx.internalAdapter.findCredentialAccount(link.auth_user_id)) await ctx.internalAdapter.updatePassword(link.auth_user_id, hash);
    else await ctx.internalAdapter.createAccount({ userId: link.auth_user_id, providerId: "credential", accountId: link.auth_user_id, password: hash });
    await q(`delete from "session" where "userId" = $1`, [link.auth_user_id]);
    await auth.api.signInEmail({ body: { email: link.login_email, password }, headers: await headers() });
  } catch {
    return { error: "Couldn't change the password. Send /web to the bot for a fresh link and try again." };
  }
  redirect("/");
}

/** Ties the signed-in Google account to the teammate who asked the bot for a /web link. */
export async function connectAccount(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const user = await getSessionUser();
  if (!user) redirect(`/connect?token=${encodeURIComponent(token)}`);
  const ok = await redeemLinkToken(token, user.id, user.email);
  if (!ok) redirect(`/connect?token=${encodeURIComponent(token)}&failed=1`);
  redirect("/");
}
