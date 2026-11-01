// Open catalogue search: no login, no key. GET /api/public/search?q=video+ads&category=ai-video&offset=0&limit=24
// Safe by design: reads only the public_items view, caps every input, does no paid work, and is cached at the CDN.
import { cleanSearch, searchPublic } from "@/lib/public-catalogue";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
};

export async function GET(req: Request) {
  if (process.env.PUBLIC_API === "off") return Response.json({ error: "The open catalogue API is paused. Try again later." }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const { text, category, offset, limit } = cleanSearch({ q: sp.get("q"), category: sp.get("category"), offset: sp.get("offset"), limit: sp.get("limit") });
  const page = await searchPublic(text, category, offset, limit);
  return new Response(JSON.stringify({ query: text, category: category || null, ...page }), { headers: HEADERS });
}

export function OPTIONS() {
  return new Response(null, { headers: { ...HEADERS, "access-control-allow-methods": "GET, OPTIONS" } });
}
