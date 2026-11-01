import { CATEGORIES } from "@/lib/contracts";
import { env } from "@/lib/env";
import { PUBLIC_PAGE_SIZE } from "@/lib/public-catalogue";

const HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
};

export function GET() {
  const doc = {
    openapi: "3.1.0",
    info: {
      title: "Orphic open catalogue API",
      version: "1.0.0",
      description: "Anonymous, read-only search over Orphic's public catalogue of AI tools found in Instagram reels. Catalogue text is CC BY 4.0.",
      license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    servers: [{ url: env.APP_URL }],
    paths: {
      "/api/public/search": {
        get: {
          operationId: "searchCatalogue",
          summary: "Search the catalogue",
          description: "Prefix-matching full-text search. `total` is the complete number of matches; page with `nextOffset` until null.",
          security: [],
          parameters: [
            { name: "q", in: "query", required: false, schema: { type: "string", maxLength: 200 }, description: "Search text. Empty returns everything." },
            { name: "category", in: "query", required: false, schema: { type: "string", enum: [...CATEGORIES] } },
            { name: "offset", in: "query", required: false, schema: { type: "integer", minimum: 0, maximum: 5000, default: 0 } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 48, default: PUBLIC_PAGE_SIZE } },
          ],
          responses: {
            "200": { description: "A page of results", content: { "application/json": { schema: { $ref: "#/components/schemas/PublicPage" } } } },
            "503": { description: "The API is paused", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string" } } } } } },
          },
        },
      },
    },
    components: {
      schemas: {
        PublicItem: {
          type: "object",
          required: ["slug", "name", "url", "domain", "summary", "category", "kind"],
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            url: { type: "string", format: "uri", description: "Verified official link, or Orphic's saved copy for Google Drive, Docs and Notion links (their owner can take those down)" },
            original_url: { type: "string", format: "uri", description: "The original link, when url is a saved copy" },
            domain: { type: ["string", "null"] },
            summary: { type: "string" },
            category: { type: "string", enum: [...CATEGORIES] },
            kind: { type: "string" },
          },
        },
        PublicPage: {
          type: "object",
          required: ["query", "category", "items", "total", "offset", "nextOffset"],
          properties: {
            query: { type: "string" },
            category: { type: ["string", "null"] },
            items: { type: "array", items: { $ref: "#/components/schemas/PublicItem" } },
            total: { type: "integer", description: "Complete number of matches" },
            offset: { type: "integer" },
            nextOffset: { type: ["integer", "null"] },
          },
        },
      },
    },
  };
  return new Response(JSON.stringify(doc), { headers: HEADERS });
}

export function OPTIONS() {
  return new Response(null, { headers: { ...HEADERS, "access-control-allow-methods": "GET, OPTIONS" } });
}
