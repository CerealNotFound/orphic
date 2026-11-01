import { randomBytes } from "node:crypto";
import { q, q1, tx } from "./db";

export async function createLinkToken(memberId: string, minutes = 30) {
  const token = randomBytes(18).toString("base64url");
  await q(`insert into link_tokens (token, member_id, expires_at) values ($1, $2, now() + make_interval(mins => $3))`, [token, memberId, minutes]);
  return token;
}

/** A valid, unused link and its teammate. login_email is set when they already have a web login. */
export async function peekLinkToken(token: string) {
  return q1<{ member_id: string; display_name: string; auth_user_id: string | null; login_email: string | null }>(
    `select t.member_id, m.display_name, m.auth_user_id, u.email as login_email
       from link_tokens t join members m on m.id = t.member_id left join "user" u on u.id = m.auth_user_id
     where t.token = $1 and t.used_at is null and t.expires_at > now() and m.disabled_at is null`,
    [token],
  );
}

/** Ties the signed-in Google account to the teammate who requested the link. */
export async function redeemLinkToken(token: string, userId: string, email: string) {
  return tx(async (c) => {
    const t = (await c.query(`select * from link_tokens where token = $1 and used_at is null and expires_at > now() for update`, [token])).rows[0];
    if (!t) return false;
    await c.query(`update members set auth_user_id = null where auth_user_id = $1`, [userId]);
    await c.query(`update members set auth_user_id = $2, email = coalesce(email, $3) where id = $1`, [t.member_id, userId, email]);
    await c.query(`update link_tokens set used_at = now() where token = $1`, [token]);
    return true;
  });
}
