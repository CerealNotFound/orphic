import { env } from "@/lib/env";

// Public instructions for AI agents (no data here; reading the library needs an API key).
export function GET() {
  const base = env.APP_URL;
  const body = `# Orphic

> A team's private library of AI tools, workflows, prompts, repos and templates, saved from Instagram reels. Each item has a verified link (when one exists), a plain-English summary, use cases, tags, who on the team saved it, and a team rating.

All endpoints need an API key: send the header \`Authorization: Bearer <key>\`. A teammate creates a key in the web app under "Connect AI".

## Read the library (agent mode, Markdown)

- [Whole library](${base}/api/v1/agent.md): every item, grouped by category. Read this first when you need the full picture.
- [Search](${base}/api/v1/agent.md?q=QUERY): every matching item, best first, full details. Use the user's words; misspellings are fine.
- Filters: \`?category=ai-video\`, \`?tag=claude-skills\`, \`?kind=repo\` (combine with q).
- [One item](${base}/api/v1/agent.md?item=SLUG): full details for one item (slug or id from a result).

The response header \`x-orphic-count\` is the number of items in the document. Lists are complete, never truncated samples.

## JSON API

- \`GET ${base}/api/v1/search?q=&limit=&offset=\`: ranked search with \`total\` and \`next_offset\`.
- \`GET ${base}/api/v1/items?category=&tag=&kind=&text=&link_status=&limit=&offset=\`: exhaustive filtered list.
- \`GET ${base}/api/v1/items/SLUG\`: one item with sources and ratings.
- \`GET ${base}/api/v1/facets\`: categories, kinds and tags with counts.

## MCP

Streamable HTTP endpoint: \`${base}/api/mcp\` (same Bearer key). Tools: search_items, list_items, get_item, list_facets, read_library, save_link, rate_item.

## How to answer users well

1. Search with the user's own words first. If nothing matches, try 2 rephrasings (synonyms, the problem they want to solve) before saying it isn't saved.
2. Quote the item name and its link exactly. Say whether the link is verified.
3. If an item is "waiting on the creator's DM", say so instead of inventing a link.
4. Mention who saved it and the team rating when choosing between options.
`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
