// Writes the worker contract as JSON Schema to /contracts so the Python worker can validate against it.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { JobResult, JobAsk, JobFail, JobProgress } from "../src/lib/contracts";

const out = join(import.meta.dirname, "..", "..", "contracts");
mkdirSync(out, { recursive: true });
const schemas = { "job-result": JobResult, "job-ask": JobAsk, "job-fail": JobFail, "job-progress": JobProgress };
for (const [name, schema] of Object.entries(schemas)) {
  writeFileSync(join(out, `${name}.schema.json`), JSON.stringify(z.toJSONSchema(schema, { io: "input" }), null, 2) + "\n");
  console.log(`wrote contracts/${name}.schema.json`);
}
