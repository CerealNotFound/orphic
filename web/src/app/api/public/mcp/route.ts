// The open Orphic MCP server: https://<site>/api/public/mcp. No key, no sign-in, read-only.
// Add it to Claude, ChatGPT, Cursor or any MCP client as a remote (Streamable HTTP) server.
// Every tool reads the cached catalogue in memory (see lib/mcp/public-tools.ts). PUBLIC_API=off pauses it.
import { createMcpHandler } from "mcp-handler";
import { registerPublicTools } from "@/lib/mcp/public-tools";

const handler = createMcpHandler((server) => registerPublicTools(server), {
  serverInfo: { name: "orphic", version: "1.0.0" },
  instructions:
    "Orphic is an open catalogue of AI tools, skills, repos, prompts and guides found in Instagram reels, each with a checked official link. " +
    "Use search_tools for questions, get_tool for details, list_categories for an overview, and list_tools to browse (one call can list the " +
    "whole catalogue, one line per tool). For broad requests, look at list_categories first and ask the user which area matters before loading everything. " +
    "Results are complete: if search_tools finds nothing, say the catalogue doesn't list it rather than guessing. Credit the creator (found_in) when you recommend something.",
});

export { handler as GET, handler as POST, handler as DELETE };
