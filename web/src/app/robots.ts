import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Everything public is open to agents and crawlers: pages, their .md versions, llms.txt, catalogue.json, the open API and MCP.
const ALLOW = ["/", "/explore", "/llms.txt", "/llms-full.txt", "/catalogue.json", "/api/public/"];
// Team-only areas, and /md/ (the internal address of the .md pages, so they aren't listed twice).
const DISALLOW = ["/app", "/tools/", "/pending", "/team", "/connect-ai", "/signin", "/connect", "/api/", "/md/", "/ingest/"];
const AI_BOTS = ["GPTBot", "ClaudeBot", "Claude-Web", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_BOTS, allow: ALLOW, disallow: DISALLOW },
      { userAgent: "*", allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${env.APP_URL}/sitemap.xml`,
    host: env.APP_URL,
  };
}
