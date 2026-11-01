// Voyage embeddings. Optional: without VOYAGE_API_KEY, search runs on keyword + fuzzy-name matching only.
import { createHash } from "node:crypto";
import { env } from "./env";
import { q } from "./db";

export const EMBED_MODEL = "voyage-4";
export const EMBED_DIM = 1024;

export const embeddingsEnabled = () => Boolean(env.VOYAGE_API_KEY);

async function embed(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const res = await fetch(`${(process.env.VOYAGE_API_URL || "https://api.voyageai.com/v1").replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.VOYAGE_API_KEY}` },
    body: JSON.stringify({ input: texts, model: EMBED_MODEL, input_type: inputType, output_dimension: EMBED_DIM }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`;

export async function embedQuery(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  try {
    return (await embed([text], "query"))[0];
  } catch (err) {
    console.error("embedQuery failed", err);
    return null;
  }
}

/** Text that represents an entity for semantic search (English summary + use cases, not raw transcripts). */
export function entityEmbeddingText(e: { name: string; kind: string; summary: string; use_cases: string[]; tags: string[]; category: string }) {
  return [`${e.name} (${e.kind}, ${e.category})`, e.summary, e.use_cases.join("; "), e.tags.join(", ")].filter(Boolean).join("\n");
}

/** (Re)embeds entities whose text changed. Safe to call often. */
export async function embedEntities(entityIds: string[]) {
  if (!embeddingsEnabled() || entityIds.length === 0) return;
  const rows = await q<{ id: string; workspace_id: string; name: string; kind: string; summary: string; use_cases: string[]; tags: string[]; category: string; content_hash: string | null }>(
    `select e.id, e.workspace_id, e.name, e.kind, e.summary, e.use_cases, e.tags, e.category, ee.content_hash
     from entities e left join entity_embeddings ee on ee.entity_id = e.id where e.id = any($1)`,
    [entityIds],
  );
  const todo = rows
    .map((r) => {
      const text = entityEmbeddingText(r);
      return { r, text, hash: createHash("sha256").update(`${EMBED_MODEL}:${text}`).digest("hex") };
    })
    .filter((x) => x.hash !== x.r.content_hash);
  if (todo.length === 0) return;
  const vectors = await embed(todo.map((t) => t.text), "document");
  for (let i = 0; i < todo.length; i++) {
    const { r, hash } = todo[i];
    await q(
      `insert into entity_embeddings (entity_id, workspace_id, model, dim, embedding, content_hash, updated_at)
       values ($1, $2, $3, $4, $5::halfvec, $6, now())
       on conflict (entity_id) do update set model = excluded.model, dim = excluded.dim, embedding = excluded.embedding,
         content_hash = excluded.content_hash, updated_at = now()`,
      [r.id, r.workspace_id, EMBED_MODEL, EMBED_DIM, toVectorLiteral(vectors[i]), hash],
    );
  }
}
