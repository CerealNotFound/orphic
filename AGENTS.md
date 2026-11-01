# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, …) working in this repository. Read this whole file before changing anything.

## What this project is
Orphic is an open-source, self-hosted **team knowledge base of AI tools, workflows and prompts captured from Instagram reels**. Teammates share reels to a Telegram bot. A worker downloads and transcribes them, an AI agent identifies the tool and verifies its link, and the team searches the result via Telegram, a web app, MCP or a REST API. One deployment = one team.

## Two different jobs you might be asked to do

| If the user asks… | Then |
|---|---|
| "process the queue", "run the worker", "handle new saves" | Follow **[WORKER.md](WORKER.md)** exactly. Don't change code. |
| anything about building, fixing or changing Orphic | Use the rest of this file. |

## Repository map

| Path | What | Language |
|---|---|---|
| `web/` | The single Next.js 16 app: web UI, Telegram webhook, REST API, MCP server, worker API, crons | TypeScript |
| `web/src/app/(app)/` | Signed-in web pages (search, tools/[slug], pending, team, connect-ai) | React Server Components |
| `web/src/app/(auth)/` | Sign-in and connect (invite) pages | |
| `web/src/app/api/` | Route handlers: `telegram`, `worker/*`, `v1/*` (REST + `agent.md`), `mcp`, `auth/[...all]`, `cron/*` | |
| `web/src/app/actions.ts` | Server Actions for the web UI (every action re-checks the member) | |
| `web/src/lib/` | Core logic: `jobs.ts` (queue + ingest), `search.ts`, `telegram/*`, `mcp/tools.ts`, `auth.ts`, `keys.ts`, `members.ts`, `contracts.ts` (zod schemas shared with the worker) | |
| `web/worker/` | The worker CLI (`pnpm worker …`): `cli.ts`, `quality.ts` (quality gate), `verify.ts` (link checker) | TypeScript |
| `web/scripts/` | Admin CLI (`pnpm orphic …`), migrations, offline bot test, contract export | |
| `db/migrations/` | Plain SQL migrations, applied in filename order by `pnpm db:migrate` | SQL |
| `contracts/` | JSON Schemas generated from `web/src/lib/contracts.ts` (`pnpm contracts`) | |
| `docs/` | User and operator docs | Markdown |

## Commands (run in `web/`, Node 24 via `nvm use`, pnpm)

| Command | Use |
|---|---|
| `pnpm dev` | Dev server on **port 3005** |
| `pnpm bot:poll` | Telegram bot in long-polling mode (auto-restarts on code changes) |
| `npx tsc --noEmit` | Typecheck. **Must pass before you finish.** |
| `pnpm lint` | ESLint. No errors allowed |
| `pnpm build` | Production build. Run after UI or route changes |
| `pnpm db:migrate` | Apply SQL + auth migrations to `DATABASE_URL` |
| `pnpm tsx --env-file=.env.local scripts/test-bot.mts <invite-code>` | Offline bot test with fake Telegram updates |
| `pnpm worker check <id>` | Run the worker quality gate on `worker/work/<id>/result.json` |

Local Postgres: `docker compose up -d` (repo root), port 54329.

## Rules

1. **Next.js 16 is not the Next.js in your training data.** Before writing Next code, read the relevant guide in `web/node_modules/next/dist/docs/`. In particular:
   - `cacheComponents` is on: request-time data must sit inside `<Suspense>`;
   - `middleware` is now `proxy` (`web/src/proxy.ts`);
   - route `params` and `searchParams` are Promises.
2. **No heavy dependencies.** No Python, no ML libraries, no new services without the maintainer's agreement. The worker uses `yt-dlp`, `ffmpeg` and `whisper-cli`, which are already on the machine.
3. **Schema changes** go in a new numbered file in `db/migrations/` (e.g. `006_add_x.sql`). Never edit an applied migration.
4. **Worker ↔ server contract:** change `web/src/lib/contracts.ts`, then run `pnpm contracts`, and update WORKER.md and `web/worker/quality.ts` if field rules change.
5. **Every query must filter by `workspace_id`** (multi-team safety), and every web action must call `requireMember()`.
6. **Security:**
   - never log secrets;
   - API keys are stored hashed only;
   - public sign-up stays disabled (logins come only from invite links);
   - see `docs/security.md`.
7. **Search must stay complete.** List-type results return every match with `total`; never silently truncate.
8. **User-facing text:** plain, short, friendly; no jargon in the bot or web UI.
9. Don't commit `.env.local` or anything under `web/worker/work/`.

## Definition of done for code changes
- `npx tsc --noEmit` passes and `pnpm lint` shows no errors.
- If you touched pages or routes: `pnpm build` passes.
- If you touched bot logic: the offline bot test runs.
- Docs are updated if behaviour changed: README, `docs/*.md`, WORKER.md.
