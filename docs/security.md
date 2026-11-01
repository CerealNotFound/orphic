# Security

How Orphic protects your team's library, and what you must do when you deploy it. To report a vulnerability, see [SECURITY.md](../SECURITY.md).

## Who can get in

| Door | How it's protected |
|---|---|
| **Telegram bot** | Invite-only. A Telegram account is a member only after opening an invite link (`/start <code>`); everyone else gets "Orphic is invite-only" and nothing else. Invite codes are random (72 bits) and limited in uses. |
| **Web app** | Email + password via [Better Auth](https://www.better-auth.com). **Public sign-up is disabled**: the sign-up endpoint returns 403. Logins can only be created from a one-time link: `/web` in Telegram (valid 30 minutes) or an admin's web invite (valid 7 days). Every page and action re-checks that the signed-in user is a current member. |
| **AI tools / API** | Personal API keys (`orp_…`, 192 bits of randomness). Only a SHA-256 hash is stored, the key is shown once, and keys stop working when their owner's access is removed. |
| **Worker** | A separate key with only the `worker` scope; it can't read the library through the search APIs. The worker itself only needs `ORPHIC_API_URL`, `ORPHIC_WORKER_KEY` and (optionally) `WHISPER_MODEL` / `CLOUDINARY_*`. If it shares `web/.env.local` with the admin CLI, that file also holds other secrets, which is why the worker session must stay locked down. |
| **Telegram webhook** | Telegram must send the secret header (`TELEGRAM_WEBHOOK_SECRET`); other requests are rejected. |
| **Scheduled jobs** | Require `Authorization: Bearer CRON_SECRET`. |

## How data is stored

- **Passwords** are hashed with scrypt (Better Auth's default) and never stored or logged in plain text.
- **Sessions** are HTTP-only cookies, so page scripts can't read them. They last 30 days and are deleted when access is removed.
- **Every table carries a team (workspace) id**, and every query filters on it.
- **Saved copies** of linked documents (PDFs, Drive files, page text, full Notion copies; up to 25 MB each in your database, larger files privately in Cloudinary) are served only to signed-in members or read API keys, with `Cache-Control: private` and a sandboxing Content-Security-Policy so scripts inside saved files never run. A full Notion copy is HTML that Orphic writes itself (all page text escaped). It may load images and videos only from your own saved copies, and runs no scripts. There are no public links to them.
- **Uploaded documents** (PDF, Word, .rtf, .odt, text files; up to 20 MB, Telegram's bot limit) are only accepted by type, and the worker re-checks the file's real contents before opening it: a program renamed to `.pdf` is refused unopened, and macro-enabled Office files aren't accepted. Text is read with macOS's built-in PDFKit and textutil (no scripts, macros or remote loading), under a time limit, and the text is treated as untrusted evidence like any reel caption.
- **Videos are deleted** after processing. Orphic keeps the text (caption, transcript, your summaries), up to 8 small keyframes during processing only, and links.
- **The database lives where you put it:** your Docker container or your own Neon/Postgres account. No data goes to any Orphic-run service, because there isn't one.

## The Claude worker and prompt injection
Reels, pages and pasted text are written by strangers and can contain instructions aimed at AI ("ignore your rules and…"). Orphic defends in layers, so no single slip is enough:

1. **Locked-down session.** Run the worker with `claude --settings ../.claude/worker-settings.json`. It allows only `pnpm worker …`, web search, and reading WORKER.md and files inside `web/` (job evidence and frames), and denies everything else:
   - no file edits or writes, except inside `web/worker/work/` (job evidence and `result.json`, git-ignored);
   - no curl, wget, git, npm, pip, shells or `open`;
   - no reading `.env`, SSH or cloud credential files;
   - bypass mode is disabled.
   
   Tested: attempts to read `.env.local` (directly and via `cat`), run curl, or write a file were all refused.
2. **The worker refuses private addresses.** Links to localhost, your LAN (192.168.x, 10.x), `.local` hosts, cloud metadata (169.254.169.254), `file://` URLs or URLs with embedded passwords are never fetched. Every redirect hop is checked too.
3. **Secrets can't leave in a result.** `submit` refuses any result containing:
   - a value from your `.env`;
   - an Orphic key, a Telegram bot token, or a private key;
   - an OpenAI, Anthropic or AWS key.
4. **Evidence is labelled untrusted,** and WORKER.md tells the agent to treat it as data and ignore embedded instructions.
5. **Downloaded media is never executed.** Videos go only to ffmpeg and whisper. Program files (`.exe`, `.dmg`, scripts) in Drive folders are never stored.
6. **Only teammates can submit content at all,** since the bot is invite-only.

## Removing access
**Team → Remove access** blocks that person's bot access, web logins and API keys immediately. Their past saves remain, credited to them.

## What you must do when deploying

1. **Use HTTPS.** Vercel does this automatically. Never run the web app on plain HTTP outside your own machine.
2. **Set strong secrets.** `BETTER_AUTH_SECRET`, `TELEGRAM_WEBHOOK_SECRET` and `CRON_SECRET` should each be `openssl rand -hex 32`. Never reuse the example values.
3. **Never set `ORPHIC_DEV_MEMBER_ID` in production.** It's a development shortcut that skips sign-in. It only works when `NODE_ENV=development`, but leave it unset anywhere public.
4. **Keep the bot token secret.** Anyone with it can impersonate your bot. If it leaks, run `/revoke` in @BotFather and update the env var.
5. **Send web invites privately.** Whoever opens a web-invite link first creates that login.
6. **Keep the worker machine trusted.** It holds the worker key and downloads untrusted media. Downloads go into their own folder and are never executed.

## Known limitations (as of this version)

- **No password-reset email.** Orphic doesn't send email. If someone forgets their password, an admin creates a new web invite for them. Self-service reset needs an email provider and is planned.
- **No two-factor auth yet.** Better Auth supports it via a plugin; not enabled.
- **Team isolation is enforced in application code.** Every query filters by workspace id, but database-level row-level security (RLS) isn't switched on. That matters only for a future multi-team hosted version; each self-hosted deployment is one team.
- **Rate limiting:** sign-in is limited to 10 attempts per 5 minutes, stored in the database so it holds across serverless instances. The waitlist allows 5 signups per IP per hour and 500 a day; IPs are stored only as salted hashes. The search APIs have no per-key rate limit yet.
- **Claude.ai / ChatGPT connectors** (OAuth sign-in for remote MCP) aren't available yet. Use API keys with Claude Code, Cursor or Gemini CLI.

## Content and terms
Orphic only processes posts that your teammates explicitly share with it. It doesn't crawl, doesn't log in to Instagram, and doesn't comment or message anyone. Using it is still your responsibility under Instagram's terms and the creators' rights. Keep the library internal, credit creators (Orphic stores the source link and handle), and don't republish their content.
