import type { z } from "zod";

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const err = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("Body must be JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  return parsed.data;
}

export type IdParams = { params: Promise<{ id: string }> };

export async function jobIdOf(ctx: IdParams): Promise<number | Response> {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isSafeInteger(n) && n > 0 ? n : err("Invalid job id");
}
