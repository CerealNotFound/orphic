// Served at /explore/category/<category>.md (see next.config.ts): one category, one line per tool.
import { categoryMd, md } from "@/lib/agent-pages";
import { catalogueIndex } from "@/lib/public-catalogue";

export async function generateStaticParams() {
  const cats = [...new Set((await catalogueIndex()).map((e) => e.category))];
  return (cats.length ? cats : ["other"]).map((category) => ({ category }));
}

export async function GET(_req: Request, ctx: RouteContext<"/md/category/[category]">) {
  const body = await categoryMd((await ctx.params).category);
  return body ? md(body) : new Response("No such category. See /explore.md for the list.\n", { status: 404 });
}
