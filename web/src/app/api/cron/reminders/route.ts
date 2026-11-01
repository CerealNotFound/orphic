// Daily nudge for "comment X to get the link" tasks: at most once a day, for the first 3 days.
import { q } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { tgApi } from "@/lib/telegram/api";
import { esc } from "@/lib/text";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const rows = await q<{ task_id: string; member_id: string; tg: string; name: string | null; keyword: string | null; url: string | null }>(
    `select t.id as task_id, t.member_id, m.telegram_user_id as tg, e.name, t.keyword, c.source_url as url
     from tasks t join members m on m.id = t.member_id left join entities e on e.id = t.entity_id left join captures c on c.id = t.capture_id
     where t.status = 'open' and m.telegram_user_id is not null
       and t.created_at < now() - interval '20 hours' and t.created_at > now() - interval '4 days'
       and (t.last_reminded_at is null or t.last_reminded_at < now() - interval '23 hours')`,
  );
  const byMember = new Map<string, typeof rows>();
  for (const r of rows) byMember.set(r.tg, [...(byMember.get(r.tg) ?? []), r]);
  let sent = 0;
  for (const [tg, tasks] of byMember) {
    const lines = tasks.map((t) => `• <b>${esc(t.name ?? "Resource")}</b>${t.keyword ? `: comment <b>${esc(t.keyword)}</b>` : ""}${t.url ? `\n  ${esc(t.url)}` : ""}`);
    try {
      await tgApi().sendMessage(Number(tg), `⏳ Still waiting on ${tasks.length} DM link(s). Forward me the link once the creator replies:\n\n${lines.join("\n")}`, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      });
      await q(`update tasks set last_reminded_at = now() where id = any($1)`, [tasks.map((t) => t.task_id)]);
      sent++;
    } catch (err) {
      console.error("reminder failed", tg, err);
    }
  }
  return Response.json({ reminded: sent });
}
