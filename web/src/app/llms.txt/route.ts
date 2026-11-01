// /llms.txt: where agents start. A map of every way into the open catalogue and what each path costs.
import { indexMd, MD_HEADERS } from "@/lib/agent-pages";

export async function GET() {
  if (process.env.PUBLIC_API === "off") return new Response("The open catalogue is paused. Try again later.\n", { status: 503 });
  return new Response(await indexMd(), { headers: { ...MD_HEADERS, "content-type": "text/plain; charset=utf-8", "x-robots-tag": "all" } });
}
