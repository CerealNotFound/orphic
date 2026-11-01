"use server";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { q, q1 } from "@/lib/db";

export type WaitlistState = { ok?: boolean; error?: string } | null;

/** Public "coming soon" signup. A hidden field catches bots; duplicates are silently accepted. */
export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  if (String(formData.get("website") ?? "")) return { ok: true }; // honeypot: bots fill every field
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Enter a valid email address." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  // Anti-flood: at most 5 signups per IP per hour and 500 per day overall. Only a salted hash of the IP is stored.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? h.get("x-real-ip") ?? "unknown").split(",")[0].trim();
  const ipHash = createHash("sha256").update(`${process.env.BETTER_AUTH_SECRET ?? ""}:${ip}`).digest("hex").slice(0, 32);
  const counts = await q1<{ per_ip: string; per_day: string }>(
    `select (select count(*) from waitlist where ip_hash = $1 and created_at > now() - interval '1 hour') as per_ip,
            (select count(*) from waitlist where created_at > now() - interval '1 day') as per_day`,
    [ipHash],
  );
  if (Number(counts?.per_ip) >= 5 || Number(counts?.per_day) >= 500) return { error: "Too many signups right now. Please try again later." };
  await q(`insert into waitlist (email, note, ip_hash) values ($1, $2, $3) on conflict (email) do nothing`, [email, note, ipHash]);
  return { ok: true };
}
