// Web sign-in (Google) via Better Auth. Teammates connect their Google account once, from a /web link sent by the Telegram bot.
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { pool, q1 } from "./db";
import type { Member } from "./members";

export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: pool,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.APP_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  socialProviders: googleConfigured()
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, prompt: "select_account" } }
    : {},
  // Email + password. New accounts are only created from a /web connect link (see createPasswordAccount);
  // the public sign-up endpoint is blocked in the auth route.
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  // Stored in Postgres so limits hold across serverless instances (memory would reset per instance).
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60, customRules: { "/sign-in/email": { window: 300, max: 10 } } },
  plugins: [nextCookies()],
});

export type Viewer = { userId: string; email: string; name: string; image: string | null; member: Member | null };

/** The signed-in user (if any) and the Orphic member they're linked to (if any). */
export async function getViewer(): Promise<Viewer | null> {
  // Local development only: act as a given member without Google sign-in.
  const devMember = process.env.NODE_ENV === "development" ? process.env.ORPHIC_DEV_MEMBER_ID : undefined;
  if (devMember) {
    const member = await q1<Member>(`select * from members where id = $1`, [devMember]);
    if (member) return { userId: "dev", email: member.email ?? "dev@localhost", name: member.display_name, image: null, member };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const member = await q1<Member>(`select * from members where auth_user_id = $1 and disabled_at is null`, [session.user.id]);
  return { userId: session.user.id, email: session.user.email, name: session.user.name, image: session.user.image ?? null, member };
}
