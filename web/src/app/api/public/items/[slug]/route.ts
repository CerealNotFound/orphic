// One tool from the open catalogue, with source credit and related tools. No login, cached at the CDN.
import { getPublicItem } from "@/lib/public-catalogue";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
};

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (process.env.PUBLIC_API === "off") return Response.json({ error: "The open catalogue API is paused. Try again later." }, { status: 503 });
  const item = await getPublicItem((await ctx.params).slug);
  if (!item) return Response.json({ error: "Not found" }, { status: 404, headers: HEADERS });
  return new Response(JSON.stringify(item), { headers: HEADERS });
}
