# Worker API (server ↔ Mac worker)

The Mac worker never touches the database or Telegram directly. It talks to the Orphic server over HTTPS.

- **Base URL:** `ORPHIC_API_URL`, e.g. `http://localhost:3000` in dev.
- **Auth:** `Authorization: Bearer <ORPHIC_WORKER_KEY>`. This is an API key with the `worker` scope, made with `pnpm orphic key --scope worker`.
- **Errors:** every error response is JSON, `{ "error": "message" }`, with a 4xx/5xx status.

## Job lifecycle

```
queued ──claim──▶ processing ──complete──▶ done
   ▲                 │  ├──ask──▶ needs_input ──(user taps a button)──▶ queued (with answer)
   │                 │  └──fail(retryable)──▶ queued   (attempts += 1; failed after 3)
   └─────────────────┘     fail(not retryable) ──▶ failed
```

A job stuck in `processing` for more than 15 minutes is put back to `queued` on the next list call.

## Endpoints

### `GET /api/worker/jobs`
Lists jobs that can be claimed (`queued`), oldest first.
```json
{ "jobs": [ { "id": 214, "kind": "reel", "created_at": "2026-10-30T10:00:00Z", "has_answer": false } ] }
```

### `POST /api/worker/jobs/{id}/claim`
Atomically moves a job from `queued` to `processing`. Returns `409` if someone else claimed it.
```json
{
  "job": {
    "id": 214,
    "kind": "reel",            // reel | link | image | text
    "input": { "url": "https://www.instagram.com/reel/ABC/", "note": "for ads project" },
    "attempts": 0,
    "question": null,          // set if this job was answered after an ask
    "answer": null,            // the option the user tapped
    "created_at": "..."
  },
  "sender": { "name": "Riya", "member_id": "uuid" },
  "open_tasks": [            // the sender's pending "comment for link" tasks, for matching a forwarded DM link
    { "id": "uuid", "keyword": "AI", "creator_handle": "someguy", "entity_name": "Prompt pack", "created_at": "..." }
  ],
  "known": {                  // set when this exact reel/link was already saved in the workspace
    "capture_id": null
  },
  "file_url": null           // for kind=image: GET this URL (same auth header) to download the image
}
```

### `GET /api/worker/jobs/{id}/file`
Streams the Telegram file (screenshot) for `kind=image` jobs. Same auth header.

### `POST /api/worker/jobs/{id}/progress`
Body: `{ "text": "Transcribing…" }`. This edits the sender's status message in Telegram. Optional; use sparingly (≤ 3 per job).

### `POST /api/worker/jobs/{id}/ask`
Body: `{ "question": "Which tool is this reel about?", "options": ["Higgsfield", "Kling", "Something else"] }`.
- The sender gets tap buttons.
- The job becomes `needs_input`.
- When they tap, it returns to `queued` with `answer` set, and the worker claims it again.

### `POST /api/worker/jobs/{id}/complete`
Body: a `JobResult`. JSON Schema: `contracts/job-result.schema.json`; the source of truth is `web/src/lib/contracts.ts`. What the server does with it:
1. Creates or updates the capture (deduplicated by reel shortcode or normalized URL).
2. Upserts entities (deduplicated by slug or domain within the workspace).
3. Records the save for the sender.
4. Creates a `comment_for_link` task if `status = pending_dm`.
5. Closes `resolves_task_id`.
6. Embeds the entities.
7. Edits the sender's Telegram message into the result card.

Returns `{ "ok": true, "capture_id": "...", "entity_ids": ["..."] }`.

### `POST /api/worker/jobs/{id}/fail`
Body: `{ "error": "yt-dlp: login required", "retryable": true }`.

### `GET /api/worker/entities?q=higgsfield`
Looks up existing entities in the workspace, so the worker can reuse names, tags and categories instead of creating near-duplicates. Returns up to 10 entries:
```json
{ "entities": [ { "id": "...", "name": "Higgsfield", "aliases": [], "canonical_url": "https://higgsfield.ai", "category": "ai-video", "tags": ["video-ads"] } ] }
```

### `GET /api/worker/tags`
Returns the tags already used in the workspace, with counts: `{ "tags": [ { "tag": "video-ads", "count": 4 } ] }`. Reuse these before inventing new ones.
