// Weekly digest posted to each workspace's team group (set with /setgroup).
import { q } from "@/lib/db";
import { cronAuthorized } from "@/lib/cron";
import { tgApi } from "@/lib/telegram/api";
import { esc, truncate } from "@/lib/text";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return new Response("Unauthorized", { status: 401 });
  const workspaces = await q<{ id: string; chat: string }>(`select id, telegram_group_chat_id as chat from workspaces where telegram_group_chat_id is not null`);
  let posted = 0;
  for (const ws of workspaces) {
    const [stats] = await q<{ saves: string; savers: string; new_items: string }>(
      `select (select count(*) from saves where workspace_id = $1 and created_at > now() - interval '7 days') as saves,
              (select count(distinct member_id) from saves where workspace_id = $1 and created_at > now() - interval '7 days') as savers,
              (select count(*) from entities where workspace_id = $1 and created_at > now() - interval '7 days') as new_items`,
      [ws.id],
    );
    if (Number(stats.saves) === 0) continue;
    const top = await q<{ name: string; summary: string; category: string; saves: string; canonical_url: string | null }>(
      `select e.name, e.summary, e.category, e.canonical_url, count(distinct s.member_id) as saves
       from entities e join capture_entities ce on ce.entity_id = e.id join saves s on s.capture_id = ce.capture_id
       where e.workspace_id = $1 and s.created_at > now() - interval '7 days'
       group by e.id order by saves desc, e.rating_score desc, max(s.created_at) desc limit 8`,
      [ws.id],
    );
    const lines = [
      `📬 <b>Orphic weekly</b>: ${stats.saves} saves by ${stats.savers} teammate(s), ${stats.new_items} new item(s)`,
      "",
      ...top.map((t) => `• <b>${esc(t.name)}</b> <i>(${esc(t.category)})</i>: ${esc(truncate(t.summary, 90))}${Number(t.saves) > 1 ? ` 👥${t.saves}` : ""}`),
      "",
      "Type @ and my name in any chat to search Orphic.",
    ];
    try {
      await tgApi().sendMessage(Number(ws.chat), lines.join("\n"), { parse_mode: "HTML", link_preview_options: { is_disabled: true } });
      posted++;
    } catch (err) {
      console.error("digest failed", ws.id, err);
    }
  }
  return Response.json({ posted });
}
