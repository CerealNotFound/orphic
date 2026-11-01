// API keys: "orp_" + random. Only a SHA-256 hash is stored.
import { createHash, randomBytes } from "node:crypto";
import { q, q1 } from "./db";

export type Scope = "worker" | "read" | "write";

export type KeyPrincipal = {
  keyId: string;
  workspaceId: string;
  memberId: string | null;
  scopes: Scope[];
};

const hash = (key: string) => createHash("sha256").update(key).digest("hex");

export async function createApiKey(opts: { workspaceId: string; memberId?: string | null; name: string; scopes: Scope[] }) {
  const key = `orp_${randomBytes(24).toString("base64url")}`;
  await q(
    `insert into api_keys (workspace_id, member_id, name, prefix, key_hash, scopes) values ($1, $2, $3, $4, $5, $6)`,
    [opts.workspaceId, opts.memberId ?? null, opts.name, key.slice(0, 10), hash(key), opts.scopes],
  );
  return key;
}

export async function verifyApiKey(key: string | null | undefined): Promise<KeyPrincipal | null> {
  if (!key || !key.startsWith("orp_")) return null;
  const row = await q1<{ id: string; workspace_id: string; member_id: string | null; scopes: Scope[] }>(
    `update api_keys k set last_used_at = now() where key_hash = $1 and revoked_at is null
       and (member_id is null or exists (select 1 from members m where m.id = k.member_id and m.disabled_at is null))
     returning id, workspace_id, member_id, scopes`,
    [hash(key)],
  );
  if (!row) return null;
  return { keyId: row.id, workspaceId: row.workspace_id, memberId: row.member_id, scopes: row.scopes };
}

export function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  return h?.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : null;
}

/** For route handlers: returns the principal or a 401/403 Response. */
export async function requireKey(req: Request, scope: Scope): Promise<KeyPrincipal | Response> {
  const p = await verifyApiKey(bearer(req));
  if (!p) return Response.json({ error: "Missing or invalid API key" }, { status: 401 });
  if (!p.scopes.includes(scope)) return Response.json({ error: `API key lacks the '${scope}' scope` }, { status: 403 });
  return p;
}
