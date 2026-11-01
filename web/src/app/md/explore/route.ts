// Served at /explore.md (see next.config.ts): the catalogue overview for agents.
import { md, overviewMd } from "@/lib/agent-pages";

export async function GET() {
  return md(await overviewMd());
}
