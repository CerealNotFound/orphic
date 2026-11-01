import { requireKey } from "@/lib/keys";
import { libraryMarkdown } from "@/lib/agent-markdown";

// Agent mode: the whole library (or the matches for ?q=) as one Markdown document.
// GET /api/v1/agent.md?q=&category=&tag=&kind=&item=<slug>
export async function GET(req: Request) {
  const p = await requireKey(req, "read");
  if (p instanceof Response) return p;
  const s = new URL(req.url).searchParams;
  const opt = (k: string) => s.get(k)?.trim() || undefined;
  const { markdown, count } = await libraryMarkdown(p.workspaceId, {
    q: opt("q"),
    item: opt("item"),
    category: opt("category"),
    tag: opt("tag"),
    kind: opt("kind"),
  });
  return new Response(markdown, { headers: { "content-type": "text/markdown; charset=utf-8", "x-orphic-count": String(count) } });
}
