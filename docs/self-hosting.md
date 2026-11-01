# Set up your own Orphic

This guide takes you from zero to a working Orphic for your team: your own Telegram bot, your own database and your own worker. Plan on about 30–45 minutes the first time.

**One deployment = one team.** If two teams want Orphic, each runs its own copy.

---

## 0. What you need

| Thing | Why | How to get it |
|---|---|---|
| A Mac (or Linux machine) that's on while people save | Runs the worker. Instagram blocks cloud servers, so downloads happen here | Your laptop works for small teams |
| **Node.js 24** + **pnpm** | Runs the app | `nvm install 24`, `npm i -g pnpm` |
| **Docker** | Local Postgres database | Docker Desktop, Colima or OrbStack |
| **yt-dlp** | Downloads reels | `brew install yt-dlp` (keep it updated: `yt-dlp -U` or `brew upgrade yt-dlp`) |
| **ffmpeg** | Extracts audio and keyframes | `brew install ffmpeg` |
| **whisper.cpp** + a model | Transcribes reels locally | `brew install whisper-cpp`, then download a model (step 4) |
| **Claude Code** | The worker's brain: identifies tools, verifies links | [claude.com/product/claude-code](https://claude.com/product/claude-code) |
| **Telegram** account | To create the bot | The Telegram app |

For going live later: a free [Vercel](https://vercel.com) account and a Postgres database (e.g. Neon, from the Vercel Marketplace).

---

## 1. Create your Telegram bot (about 5 minutes)

All of this happens in a chat with **@BotFather**, Telegram's official bot for making bots.

1. In Telegram, search for **@BotFather** (blue check) and press **Start**.
2. Send `/newbot`.
3. **Name:** what people see, e.g. `Orphic`.
4. **Username:** must be unique and end in `bot`, e.g. `acme_orphic_bot`.
5. BotFather replies with a **token** like `7123456789:AAH…`. It's a password: anyone who has it controls your bot. Never commit it or post it.

Then configure it. Send each command to @BotFather and pick your bot when asked:

| Command | What to send | Why |
|---|---|---|
| `/setinline` | `Search Orphic…` | Lets people type `@yourbot query` in any chat to search |
| `/setjoingroups` | **Enable** | So you can add the bot to your team group (for the weekly digest) |
| `/setprivacy` | leave **Enabled** | In groups the bot only sees messages that mention it or are commands |
| `/setcommands` | the list below | Shows a command menu in the chat |
| `/setdescription` | `Share reels, links or screenshots of AI tools here. Orphic finds the tool and its real link, and saves it for the whole team. Type anything to search.` | Shown before someone starts the chat |
| `/setabouttext` | `Your team's memory for AI tools spotted in reels.` | Profile blurb |
| `/setuserpic` | a square image | Optional |

Command list for `/setcommands`:
```
search - Search Orphic
recent - Latest saves from the team
pending - Links you still need to grab from a creator's DM
web - Open Orphic on the web
invite - Invite link for a teammate
help - How to use Orphic
setgroup - Make this the team group (admins)
```

---

## 2. Run it locally

```bash
git clone <this repo> orphic && cd orphic
docker compose up -d                 # Postgres 17 + pgvector, on localhost:54329
cd web
nvm use                              # Node 24 (from .nvmrc)
pnpm install
cp .env.example .env.local
```

Edit `web/.env.local`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Keep the default for local Docker |
| `APP_URL` | `http://localhost:3005` locally; your public URL once deployed |
| `TELEGRAM_BOT_TOKEN` | The token from BotFather |
| `TELEGRAM_BOT_USERNAME` | The bot's username **without** `@`, e.g. `acme_orphic_bot` |
| `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `BETTER_AUTH_SECRET` | Long random strings. Make each with `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Same as `APP_URL` |
| `WHISPER_MODEL` | Absolute path to your whisper model file (step 4) |
| `ORPHIC_WORKER_KEY` | Printed by `pnpm orphic setup` (next step) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional, only if you also want "Sign in with Google" |
| `ORPHIC_DEV_MEMBER_ID` | Leave empty. A development-only shortcut that skips sign-in |

Then:

```bash
pnpm db:migrate                      # creates all tables
pnpm orphic setup "My Team"          # creates your team
```

`setup` prints three things:
1. **An owner link.** Open it in Telegram yourself first and press Start; you become the owner. It works once.
2. **A team link.** Share it with teammates; it works up to 50 times.
3. **A worker key.** Put it in `.env.local` as `ORPHIC_WORKER_KEY`.

Start the app and the bot (two terminals):

```bash
pnpm dev                             # web app → http://localhost:3005
pnpm bot:poll                        # Telegram bot, "long polling" mode: no public URL needed
```

Send your bot a message. It should answer.

---

## 3. Tell the bot where your team group is (optional)

1. Create a Telegram group with your team and add the bot.
2. In the group, send `/setgroup`. You must be the owner or an admin.

The weekly digest ("this week the team saved…") gets posted there.

---

## 4. Set up the worker

The worker turns queued shares into saved items.

**a. Whisper model.** If you don't have a whisper.cpp model yet, download one. `medium` is a good balance and handles Hindi/Hinglish:
```bash
mkdir -p ~/whisper-models && cd ~/whisper-models
curl -L -o ggml-medium.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin   # ~1.5 GB
```
Set `WHISPER_MODEL=/Users/you/whisper-models/ggml-medium.bin` in `web/.env.local`.

**b. Test the pipeline** (no server or bot needed):
```bash
cd web
pnpm worker extract-url "https://www.instagram.com/reel/<some-public-reel>/"
```
It prints the path to an `evidence.md` with the caption, transcript and keyframes.

**c. Run the worker loop.** Open Claude Code in the repo folder and say *"process the Orphic queue"*. Claude follows [WORKER.md](../WORKER.md):
1. It watches the queue with `pnpm worker watch`.
2. For each job it claims, extracts and reads the evidence.
3. It verifies the link with a web search and submits the result.

The sender's message in Telegram then turns into the finished card. Keep that session open while your team is saving; shares queue up safely while it's closed.

---

## 5. Go live (Vercel + Neon)

Running locally works, but your laptop has to be on, and the web app is only reachable from it. To give the team a real URL:

1. Install the Vercel CLI and log in: `npm i -g vercel && vercel login`.
2. In `web/`: `vercel link` to create the project.
3. Add a Postgres database: in the Vercel dashboard → Storage / Marketplace → **Neon**. This sets `DATABASE_URL`.
4. Add the other environment variables (`vercel env add …` or the dashboard). Set:
   - `APP_URL` and `BETTER_AUTH_URL` to your production URL, e.g. `https://orphic-acme.vercel.app`;
   - **don't** set `ORPHIC_DEV_MEMBER_ID`.
5. Tables are created automatically on every deploy (the `vercel-build` script runs migrations before building).
6. Create your team on Neon: `DATABASE_URL="<neon url>" pnpm orphic setup "My Team"`.
7. Deploy: `vercel deploy --prod`.
8. Point Telegram at it (instead of `bot:poll`): `pnpm orphic webhook https://orphic-acme.vercel.app`.
9. On your worker machine, set `ORPHIC_API_URL=https://orphic-acme.vercel.app` and the new `ORPHIC_WORKER_KEY` in `web/.env.local`. If you added a custom domain, use that domain here: the `.vercel.app` address redirects to it, and the worker stops with a message instead of following the redirect.

The scheduled jobs (weekly digest, daily DM reminders) are defined in `web/vercel.ts` and run automatically on Vercel. They authenticate with `CRON_SECRET`.

To go back to local mode later, run `pnpm bot:poll`; it removes the webhook automatically.

---

## Useful commands (in `web/`)

| Command | What it does |
|---|---|
| `pnpm orphic invite` | A new team invite link (Telegram) |
| `pnpm orphic key read\|write\|worker [name]` | Create an API key |
| `pnpm orphic webhook <https-url>` | Point Telegram at a deployed app |
| `pnpm orphic webhook-info` | What Telegram thinks the webhook is |
| `pnpm worker snapshot <job id> <url> --replace` | Copy a link again (e.g. a Notion site saved before full copies existed) and remove its older copies. Without `<url>`, re-copies an uploaded file (PDF/document) job |
| `pnpm worker store-drive <job id> <drive-url> [--only-docs \| --only <path>]` | Copy a Drive folder's files to Cloudinary again: just its Google Docs/Sheets/Slides (exported as PDF/Excel), or one file that failed |
| `pnpm worker frame <job id> <seconds>` | Full-resolution still from a reel already downloaded for a job (to read small on-screen text) |
| `pnpm orphic delete <slug or name>… [--yes]` | Remove items saved by mistake. Without `--yes` it only shows what would change. If an item was a post's main item, the next item from that post takes its place. For the live site, put the production `DATABASE_URL="…"` in front |
| `pnpm worker watch --once` | Show the queue |
| `pnpm worker extract-url <url>` | Test the pipeline on any reel or link |
| `pnpm tsx --env-file=.env.local scripts/test-bot.mts <invite-code>` | Offline bot test with fake Telegram updates |

## Troubleshooting

| Problem | Fix |
|---|---|
| Bot doesn't answer | Is `pnpm bot:poll` running (local) or the webhook set (`pnpm orphic webhook-info`)? Only one of the two can be active. |
| "Orphic is invite-only" | You haven't joined yet. Open an invite link from `pnpm orphic setup` or `pnpm orphic invite`. |
| Saves stay at "📥 Got it" | No worker session is running. Start Claude Code and process the queue. |
| `download failed … empty media response` | The reel is private or removed, or Instagram is rate-limiting. Run `yt-dlp -U`, then try again later. |
| Transcript is garbled | Check `WHISPER_MODEL` points to a multilingual model (`ggml-medium.bin`, not `*.en.bin`). |
