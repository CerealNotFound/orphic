// The processing queue and ingestion of worker results.
import { InlineKeyboard } from "grammy";
import type { PoolClient } from "pg";
import { q, q1, tx } from "./db";
import { embedEntities } from "./embeddings";
import { attachJobSnapshots } from "./snapshots";
import type { EntityInput, JobResult } from "./contracts";
import { getEntity, type EntityHit } from "./search";
import { editOrSend } from "./telegram/api";
import { entityCard, entityKeyboard, pendingDmCard } from "./telegram/cards";
import { domainOf, esc, normalizeUrl, slugify, sourceKeyFor, truncate } from "./text";

export type JobKind = "reel" | "link" | "image" | "text" | "file";
export type JobInput = {
  url?: string;
  note?: string;
  telegram_file_id?: string;
  telegram_file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  text?: string;
  source_key?: string;
};

export type JobRow = {
  id: string;
  workspace_id: string;
  member_id: string;
  kind: JobKind;
  input: JobInput;
  status: string;
  attempts: number;
  question: { text: string; options: string[] } | null;
  answer: string | null;
  error: string | null;
  capture_id: string | null;
  telegram_chat_id: string | null;
  telegram_message_id: string | null;
  created_at: string;
};

const MAX_ATTEMPTS = 3;
const STALE_MINUTES = 15;

export function sourceKeyForJob(kind: JobKind, input: JobInput): string | null {
  if (input.url) return sourceKeyFor(input.url);
  if ((kind === "image" || kind === "file") && input.telegram_file_unique_id) return `tg:${input.telegram_file_unique_id}`;
  return null;
}

export async function enqueueJob(opts: { workspaceId: string; memberId: string; kind: JobKind; input: JobInput; chatId: number | null; messageId: number | null }) {
  const row = await q1<{ id: string }>(
    `insert into jobs (workspace_id, member_id, kind, input, telegram_chat_id, telegram_message_id)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [opts.workspaceId, opts.memberId, opts.kind, opts.input, opts.chatId, opts.messageId],
  );
  return Number(row!.id);
}

/** If this reel/link is already saved in the workspace, returns its capture and primary entity. */
export async function findExistingCapture(workspaceId: string, sourceKey: string) {
  return q1<{ capture_id: string; status: string; entity_id: string | null; saved_by: string[] }>(
    `select c.id as capture_id, c.status,
            (select ce.entity_id from capture_entities ce where ce.capture_id = c.id order by (ce.role = 'primary') desc limit 1) as entity_id,
            coalesce((select array_agg(m.display_name) from saves s join members m on m.id = s.member_id where s.capture_id = c.id), '{}') as saved_by
     from captures c where c.workspace_id = $1 and c.source_key = $2`,
    [workspaceId, sourceKey],
  );
}

export async function addSave(workspaceId: string, captureId: string, memberId: string, note?: string | null) {
  await q(`insert into saves (workspace_id, capture_id, member_id, note) values ($1, $2, $3, $4) on conflict (capture_id, member_id) do nothing`, [
    workspaceId,
    captureId,
    memberId,
    note ?? null,
  ]);
  await refreshSaveCounts(null, await entityIdsForCapture(captureId));
}

async function entityIdsForCapture(captureId: string) {
  return (await q<{ entity_id: string }>(`select entity_id from capture_entities where capture_id = $1`, [captureId])).map((r) => r.entity_id);
}

async function refreshSaveCounts(c: PoolClient | null, entityIds: string[]) {
  if (!entityIds.length) return;
  const sql = `update entities e set save_count = (
      select count(distinct s.member_id) from capture_entities ce join saves s on s.capture_id = ce.capture_id where ce.entity_id = e.id)
    where e.id = any($1)`;
  if (c) await c.query(sql, [entityIds]);
  else await q(sql, [entityIds]);
}

// --- worker side -----------------------------------------------------------

export async function listClaimable(workspaceId: string) {
  await q(
    `update jobs set status = 'queued', updated_at = now()
     where workspace_id = $1 and status = 'processing' and claimed_at < now() - interval '${STALE_MINUTES} minutes'`,
    [workspaceId],
  );
  return q<{ id: string; kind: string; created_at: string; has_answer: boolean }>(
    `select id, kind, created_at, (answer is not null) as has_answer from jobs
     where workspace_id = $1 and status = 'queued'
       -- a pasted text may still be arriving in several Telegram messages; wait until it's quiet
       and not (kind = 'text' and updated_at > now() - interval '20 seconds')
     order by created_at limit 50`,
    [workspaceId],
  );
}

export async function claimJob(workspaceId: string, jobId: number) {
  const job = await q1<JobRow>(
    `update jobs set status = 'processing', claimed_at = now(), updated_at = now()
     where id = $1 and workspace_id = $2 and status = 'queued' returning *`,
    [jobId, workspaceId],
  );
  if (!job) return null;
  const [sender, openTasks] = await Promise.all([
    q1<{ display_name: string }>(`select display_name from members where id = $1`, [job.member_id]),
    q(
      `select t.id, t.keyword, coalesce(e.creator_handle, c.creator_handle) as creator_handle, e.name as entity_name, c.source_url as reel_url, t.created_at
       from tasks t left join entities e on e.id = t.entity_id left join captures c on c.id = t.capture_id
       where t.member_id = $1 and t.status = 'open' order by t.created_at desc limit 20`,
      [job.member_id],
    ),
  ]);
  const key = sourceKeyForJob(job.kind, job.input);
  const known = key ? await findExistingCapture(workspaceId, key) : null;
  return {
    job: { id: Number(job.id), kind: job.kind, input: job.input, attempts: job.attempts, question: job.question, answer: job.answer, created_at: job.created_at },
    sender: { name: sender?.display_name ?? "someone", member_id: job.member_id },
    open_tasks: openTasks,
    known: { capture_id: known?.capture_id ?? null },
    file_url: job.kind === "image" || job.kind === "file" ? `/api/worker/jobs/${job.id}/file` : null,
  };
}

async function jobFor(workspaceId: string, jobId: number) {
  return q1<JobRow>(`select * from jobs where id = $1 and workspace_id = $2`, [jobId, workspaceId]);
}

const chatOf = (job: JobRow) => (job.telegram_chat_id ? { chat: Number(job.telegram_chat_id), msg: job.telegram_message_id ? Number(job.telegram_message_id) : null } : null);

export async function progressJob(workspaceId: string, jobId: number, text: string) {
  const job = await jobFor(workspaceId, jobId);
  if (!job) return false;
  const t = chatOf(job);
  if (t) await editOrSend(t.chat, t.msg, `⏳ #${job.id}: ${esc(text)}`);
  return true;
}

export async function askJob(workspaceId: string, jobId: number, question: string, options: string[]) {
  const job = await q1<JobRow>(
    `update jobs set status = 'needs_input', question = $3, answer = null, updated_at = now()
     where id = $1 and workspace_id = $2 and status = 'processing' returning *`,
    [jobId, workspaceId, { text: question, options }],
  );
  if (!job) return false;
  const t = chatOf(job);
  if (t) {
    const kb = new InlineKeyboard();
    options.forEach((o, i) => kb.text(o, `ans:${job.id}:${i}`).row());
    await editOrSend(t.chat, t.msg, `❓ #${job.id}: ${esc(question)}`, kb);
  }
  return true;
}

/** Called when the user taps an answer button. */
export async function answerJob(jobId: number, memberId: string, optionIndex: number) {
  const job = await q1<JobRow>(`select * from jobs where id = $1 and member_id = $2 and status = 'needs_input'`, [jobId, memberId]);
  const answer = job?.question?.options[optionIndex];
  if (!job || answer === undefined) return null;
  await q(`update jobs set status = 'queued', answer = $2, updated_at = now() where id = $1`, [jobId, answer]);
  return answer;
}

export async function failJob(workspaceId: string, jobId: number, error: string, retryable: boolean) {
  const job = await jobFor(workspaceId, jobId);
  if (!job) return false;
  const requeue = retryable && job.attempts + 1 < MAX_ATTEMPTS;
  await q(`update jobs set status = $3, attempts = attempts + 1, error = $4, updated_at = now() where id = $1 and workspace_id = $2`, [
    jobId,
    workspaceId,
    requeue ? "queued" : "failed",
    error,
  ]);
  const t = chatOf(job);
  if (t && !requeue) {
    await editOrSend(
      t.chat,
      t.msg,
      `⚠️ #${job.id}: couldn't process this one.\n<i>${esc(truncate(error, 300))}</i>`,
      new InlineKeyboard().text("🔁 Retry", `retry:${job.id}`),
    );
  }
  return true;
}

export async function retryJob(jobId: number, memberId: string) {
  const job = await q1<JobRow>(
    `update jobs set status = 'queued', attempts = 0, error = null, updated_at = now()
     where id = $1 and member_id = $2 and status = 'failed' returning *`,
    [jobId, memberId],
  );
  return Boolean(job);
}

// --- ingestion -----------------------------------------------------------------

// Domains shared by many unrelated resources: never merge entities just because they share these.
const SHARED_DOMAINS = new Set([
  "instagram.com", "youtube.com", "youtu.be", "github.com", "notion.site", "notion.so", "docs.google.com", "drive.google.com",
  "linktr.ee", "gumroad.com", "bit.ly", "x.com", "twitter.com", "tiktok.com", "medium.com", "substack.com", "beacons.ai",
  "stan.store", "t.me", "chromewebstore.google.com", "apps.apple.com", "play.google.com", "huggingface.co", "n8n.io",
]);

const LINK_RANK: Record<string, number> = { none: 0, unavailable: 0, unverified: 1, pending_dm: 2, saved: 3, verified: 4 };

const uniq = (xs: (string | null | undefined)[], max = 30) => [...new Set(xs.filter((x): x is string => Boolean(x && x.trim())).map((x) => x.trim()))].slice(0, max);

async function upsertEntity(c: PoolClient, workspaceId: string, e: EntityInput, resultStatus: string, hasContent: boolean): Promise<string> {
  const url = e.canonical_url ? normalizeUrl(e.canonical_url) : null;
  const domain = domainOf(url);
  const slug = slugify(e.name);
  const linkStatus = url
    ? e.link_verified ? "verified" : "unverified"
    : e.is_creator_owned
      ? resultStatus === "pending_dm" ? "pending_dm" : hasContent ? "saved" : "pending_dm"
      : "none";
  const names = uniq([e.name, ...e.aliases]).map((n) => n.toLowerCase());

  const existing = (
    await c.query(
      `select * from entities where workspace_id = $1 and (
         slug = $2
         or exists (select 1 from unnest(aliases || array[name]) a where lower(a) = any($3::text[]))
         or ($4::text is not null and not $5 and domain = $4)
         or ($6::text is not null and canonical_url = $6))
       order by (slug = $2) desc, updated_at desc limit 1 for update`,
      [workspaceId, slug, names, domain, domain ? SHARED_DOMAINS.has(domain) : true, url],
    )
  ).rows[0];

  if (!existing) {
    const row = (
      await c.query(
        `insert into entities (workspace_id, kind, name, slug, aliases, canonical_url, domain, summary, use_cases, category, tags, pricing,
                               is_creator_owned, creator_handle, link_status, names_text, search_terms)
         values ($1,$2,$3,
                 (select case when exists (select 1 from entities where workspace_id = $1 and slug = $4) then $4 || '-' || substr(md5(random()::text), 1, 4) else $4 end),
                 $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         returning id`,
        [
          workspaceId, e.kind, e.name.trim(), slug, uniq(e.aliases), url, domain, e.summary, uniq(e.use_cases, 12), e.category,
          uniq(e.tags.map((t) => slugify(t)), 15), e.pricing ?? null, e.is_creator_owned, e.creator_handle ?? null, linkStatus,
          uniq([e.name, ...e.aliases]).join(" "),
          uniq(e.search_terms, 40),
        ],
      )
    ).rows[0];
    return row.id;
  }

  const aliases = uniq([...existing.aliases, ...(existing.name.toLowerCase() !== e.name.toLowerCase() ? [e.name] : []), ...e.aliases]);
  const better = LINK_RANK[linkStatus] > LINK_RANK[existing.link_status];
  await c.query(
    `update entities set
       aliases = $2, names_text = $3,
       canonical_url = case when $4::boolean then $5 else coalesce(canonical_url, $5) end,
       domain = case when $4::boolean then $6 else coalesce(domain, $6) end,
       link_status = case when $4::boolean then $7 else link_status end,
       summary = case when summary = '' then $8 else summary end,
       use_cases = $9, tags = $10,
       pricing = coalesce(pricing, $11),
       creator_handle = coalesce(creator_handle, $12),
       category = case when category = 'other' then $13 else category end,
       search_terms = $14,
       updated_at = now()
     where id = $1`,
    [
      existing.id, aliases, uniq([existing.name, ...aliases]).join(" "), better, url, domain, linkStatus, e.summary,
      uniq([...existing.use_cases, ...e.use_cases], 12), uniq([...existing.tags, ...e.tags.map((t) => slugify(t))], 15),
      e.pricing ?? null, e.creator_handle ?? null, e.category,
      uniq([...(existing.search_terms ?? []), ...e.search_terms], 40),
    ],
  );
  return existing.id;
}

/** Rebuilds the keyword-search document of entities from their own fields + linked captures. */
export async function refreshSearchDocs(c: PoolClient, entityIds: string[]) {
  if (!entityIds.length) return;
  await c.query(
    `update entities e set search_doc = concat_ws(E'\\n',
        e.name, array_to_string(e.aliases, ' '), e.kind, e.category, array_to_string(e.tags, ' '), e.domain,
        e.summary, array_to_string(e.use_cases, '. '), array_to_string(e.search_terms, '. '), e.creator_handle,
        (select string_agg(concat_ws(' ', c.summary, left(c.caption, 600), left(c.ocr_text, 400), left(c.transcript, 1500), left(c.archived_content, 1500)), E'\\n')
         from capture_entities ce join captures c on c.id = ce.capture_id
         -- only the reel/page that is mainly about this item; a page that merely mentions 38 tools must not make them all match each other
         where ce.entity_id = e.id and ce.role = 'primary'))
     where e.id = any($1)`,
    [entityIds],
  );
}

export async function completeJob(workspaceId: string, jobId: number, result: JobResult) {
  const out = await tx(async (c) => {
    const job = (await c.query<JobRow>(`select * from jobs where id = $1 and workspace_id = $2 for update`, [jobId, workspaceId])).rows[0];
    if (!job) return { error: "Job not found", status: 404 } as const;
    if (job.status === "done") return { error: "Job already completed", status: 409 } as const;

    const cap = result.capture;
    const sourceUrl = cap.source_url ?? job.input.url ?? null;
    const sourceKey = sourceKeyForJob(job.kind, { ...job.input, url: sourceUrl ?? undefined }) ?? `job:${job.id}`;
    const capture = (
      await c.query(
        `insert into captures (workspace_id, kind, source_url, source_key, creator_handle, caption, transcript, ocr_text, comments_excerpt,
                               language, archived_content, status, confidence, summary)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         on conflict (workspace_id, source_key) do update set
           creator_handle = coalesce(excluded.creator_handle, captures.creator_handle),
           caption = coalesce(excluded.caption, captures.caption),
           transcript = coalesce(excluded.transcript, captures.transcript),
           ocr_text = coalesce(excluded.ocr_text, captures.ocr_text),
           comments_excerpt = coalesce(excluded.comments_excerpt, captures.comments_excerpt),
           language = coalesce(excluded.language, captures.language),
           archived_content = coalesce(excluded.archived_content, captures.archived_content),
           -- never downgrade: a re-run that finds less keeps the better earlier result
           status = case when array_position(array['unresolved','needs_user','pending_dm','ok'], excluded.status)
                              >= array_position(array['unresolved','needs_user','pending_dm','ok'], captures.status)
                         then excluded.status else captures.status end,
           confidence = greatest(excluded.confidence, captures.confidence),
           summary = coalesce(excluded.summary, captures.summary)
         returning id`,
        [
          workspaceId, job.kind, sourceUrl, sourceKey, cap.creator_handle ?? null, cap.caption ?? null, cap.transcript ?? null,
          cap.ocr_text ?? null, cap.comments_excerpt ?? null, cap.language ?? null, cap.archived_content ?? null, result.status,
          result.confidence, cap.summary ?? null,
        ],
      )
    ).rows[0];

    const entityIds: string[] = [];
    for (const e of result.entities) {
      const id = await upsertEntity(c, workspaceId, e, result.status, Boolean(cap.archived_content || job.kind === "text" || job.kind === "image" || job.kind === "file"));
      entityIds.push(id);
      await c.query(
        `insert into capture_entities (capture_id, entity_id, role) values ($1, $2, $3)
         on conflict (capture_id, entity_id) do update set role = case when excluded.role = 'primary' then 'primary' else capture_entities.role end`,
        [capture.id, id, e.role],
      );
    }

    await c.query(
      `insert into saves (workspace_id, capture_id, member_id, note) values ($1, $2, $3, $4) on conflict (capture_id, member_id) do nothing`,
      [workspaceId, capture.id, job.member_id, job.input.note ?? null],
    );

    // A forwarded DM link that completes a pending "comment for link" task.
    let resolvedEntityId: string | null = null;
    if (result.resolves_task_id) {
      const task = (
        await c.query(`update tasks set status = 'done', done_at = now() where id = $1 and workspace_id = $2 and status = 'open' returning entity_id`, [
          result.resolves_task_id,
          workspaceId,
        ])
      ).rows[0];
      if (task?.entity_id) {
        resolvedEntityId = task.entity_id;
        const link = sourceUrl ? normalizeUrl(sourceUrl) : null;
        await c.query(
          `update entities set canonical_url = coalesce($2, canonical_url), domain = coalesce($3, domain),
             link_status = case when $2::text is not null then 'verified' else link_status end, updated_at = now() where id = $1`,
          [task.entity_id, link, domainOf(link)],
        );
        await c.query(`insert into capture_entities (capture_id, entity_id, role) values ($1, $2, 'primary') on conflict do nothing`, [
          capture.id,
          task.entity_id,
        ]);
        if (!entityIds.includes(task.entity_id)) entityIds.push(task.entity_id);
      }
    }

    // Creator-only resource: ask the sender to comment and forward the DM.
    let task: { keyword: string | null } | null = null;
    if (result.status === "pending_dm") {
      const primary = result.entities.find((e) => e.is_creator_owned) ?? result.entities[0];
      const entityId = primary ? entityIds[result.entities.indexOf(primary)] : null;
      const open = (await c.query(`select 1 from tasks where capture_id = $1 and member_id = $2 and status = 'open'`, [capture.id, job.member_id])).rows[0];
      if (!open) {
        await c.query(
          `insert into tasks (workspace_id, member_id, capture_id, entity_id, kind, keyword) values ($1, $2, $3, $4, 'comment_for_link', $5)`,
          [workspaceId, job.member_id, capture.id, entityId, primary?.comment_keyword ?? null],
        );
      }
      task = { keyword: primary?.comment_keyword ?? null };
    }

    await refreshSaveCounts(c, entityIds);
    await refreshSearchDocs(c, entityIds);
    await c.query(`update jobs set status = 'done', result = $2, capture_id = $3, error = null, updated_at = now() where id = $1`, [
      jobId,
      result,
      capture.id,
    ]);
    return { job, captureId: capture.id as string, entityIds, task, resolvedEntityId };
  });

  if ("error" in out) return out;

  await attachJobSnapshots(jobId, out.captureId);

  try {
    await embedEntities(out.entityIds);
  } catch (err) {
    console.error("embedding failed (search still works by keyword)", err);
  }
  await notifyResult(workspaceId, out.job, result, out.entityIds, out.task, out.resolvedEntityId);
  return { ok: true as const, capture_id: out.captureId, entity_ids: out.entityIds };
}

async function notifyResult(
  workspaceId: string,
  job: JobRow,
  result: JobResult,
  entityIds: string[],
  task: { keyword: string | null } | null,
  resolvedEntityId: string | null,
) {
  const t = chatOf(job);
  if (!t) return;
  const note = result.reply_note ? `\n\n<i>${esc(result.reply_note)}</i>` : "";
  const primaryId = resolvedEntityId ?? entityIds[0];
  const primary = primaryId ? await getEntity(workspaceId, primaryId) : null;

  if (!primary) {
    await editOrSend(t.chat, t.msg, `❓ #${job.id}: saved, but I couldn't tell which tool this is about. I kept the transcript and text, so it's still searchable.${note}`);
    return;
  }
  if (result.status === "pending_dm" && !resolvedEntityId) {
    await editOrSend(
      t.chat,
      t.msg,
      pendingDmCard(primary as EntityHit, task?.keyword ?? null, result.capture.source_url ?? job.input.url ?? null) + note,
      new InlineKeyboard().text("✅ I commented", `commented:${job.id}`).text("🚫 DM never came", `nodm:${primary.id}`),
    );
    return;
  }
  const header = resolvedEntityId ? "🎉 Got the DM link. Saved:" : undefined;
  const extra = entityIds.length > 1 ? `\n\n+ ${entityIds.length - 1} more tool(s) mentioned in this reel.` : "";
  await editOrSend(t.chat, t.msg, entityCard(primary as EntityHit, { header }) + extra + note, entityKeyboard(primary as EntityHit));
}
