import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyApiKey } from "@/lib/keys";
import { registerOrphicTools } from "@/lib/mcp/tools";

const handler = createMcpHandler((server) => registerOrphicTools(server), {
  serverInfo: { name: "orphic", version: "0.1.0" },
});

// API keys today (Claude Code, Cursor, Gemini CLI via an Authorization header).
// OAuth sign-in for claude.ai / ChatGPT connectors plugs in here once Google sign-in is configured.
const authed = withMcpAuth(
  handler,
  async (_req, token) => {
    const p = await verifyApiKey(token);
    if (!p || !(p.scopes.includes("read") || p.scopes.includes("write"))) return undefined;
    return { token: token!, clientId: p.keyId, scopes: p.scopes, extra: { workspaceId: p.workspaceId, memberId: p.memberId } };
  },
  { required: true },
);

export { authed as GET, authed as POST };
