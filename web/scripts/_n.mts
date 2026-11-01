import { pool, q } from "../src/lib/db";
const rows = await q(`
  select c.id as capture, c.kind, c.source_url, c.created_at::date as saved,
    (select string_agg(e.name || ' [' || ce.role || ']', '; ') from capture_entities ce join entities e on e.id = ce.entity_id where ce.capture_id = c.id) as items,
    (select json_agg(json_build_object('kind', s.kind, 'file', s.filename, 'kb', s.size_bytes/1024, 'store', s.storage, 'ok', s.complete)) from snapshots s where s.capture_id = c.id) as copies
  from captures c
  where c.source_url ~* 'notion\\.(site|so|com)' or c.archived_content ~* 'notion\\.(site|so)/'
     or exists (select 1 from capture_entities ce join entities e on e.id = ce.entity_id where ce.capture_id = c.id and e.canonical_url ~* 'notion\\.(site|so)')
  order by c.created_at`);
console.log(JSON.stringify(rows, null, 1));
await pool.end();
