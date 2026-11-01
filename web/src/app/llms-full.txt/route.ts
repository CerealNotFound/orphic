// /llms-full.txt: the whole open catalogue in full, one request (for agents that want everything).
import { fullMd, MD_HEADERS } from "@/lib/agent-pages";

export async function GET() {
  if (process.env.PUBLIC_API === "off") return new Response("The open catalogue is paused. Try again later.\n", { status: 503 });
  return new Response(await fullMd(), { headers: { ...MD_HEADERS, "content-type": "text/plain; charset=utf-8", "x-robots-tag": "all" } });
}
