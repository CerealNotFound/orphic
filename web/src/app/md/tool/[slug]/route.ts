// Served at /explore/<slug>.md (see next.config.ts): one tool in full, for agents.
import { md, toolMd } from "@/lib/agent-pages";
import { publicSlugs } from "@/lib/public-catalogue";

export async function generateStaticParams() {
  const slugs = await publicSlugs();
  return (slugs.length ? slugs : ["_"]).map((slug) => ({ slug }));
}

export async function GET(_req: Request, ctx: RouteContext<"/md/tool/[slug]">) {
  const body = await toolMd((await ctx.params).slug);
  return body ? md(body) : new Response("No such tool. Search with /api/public/search?q=… or see /explore.md.\n", { status: 404 });
}
