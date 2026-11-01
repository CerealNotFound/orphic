// /catalogue.json: the whole open catalogue as JSON, one request (for code that wants everything).
import { catalogueJson } from "@/lib/agent-pages";

export async function GET() {
  if (process.env.PUBLIC_API === "off") return Response.json({ error: "The open catalogue is paused. Try again later." }, { status: 503 });
  return Response.json(await catalogueJson(), {
    headers: { "access-control-allow-origin": "*", "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
