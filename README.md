<p align="center"><img src="docs/assets/logo.svg" width="88" alt="Orphic logo: Orpheus' lyre"></p>

<h1 align="center">Orphic</h1>

**A shared memory for the AI tools, workflows and prompts your team spots in Instagram reels.**

Someone on your team sees a reel ("this Claude skill makes animations…", "comment SKILL and I'll DM you the link"). They share it to the Orphic Telegram bot in two taps. Orphic then:
1. downloads the reel and transcribes it;
2. reads the text on screen;
3. works out which tool or resource it is;
4. finds and verifies the real link;
5. saves it for the whole team.

Later, anyone can ask "what was that tool for anime-style videos?" in Telegram, on the web, or from their own AI assistant.

Orphic is open source (MIT). **Each deployment is one team.** You run your own copy with your own bot, and your team's data stays in your own database.

---

## What it does

- **Two-tap capture.** Instagram → Share → Telegram → Orphic. Links, Google Docs, Drive files and screenshots work too.
- **Finds the real link:**
  - Reads the caption, the transcript (English or Hinglish), the comments and the text in video frames.
  - Then verifies the official site or GitHub repo.
- **"Comment X to get the link":**
  - Often the link is visible in the reel, and Orphic finds it so nobody has to comment.
  - If not, it gives you a to-do. Forward the creator's DM when it arrives and Orphic attaches it.
  - If the creator's automation never sends anything, tap 🚫 to close it.
- **Team memory:**
  - Duplicate saves merge, so you see "also saved by Riya".
  - Teammates rate tools 👍 / 👎.
  - A weekly digest goes to your team group.
- **Search that doesn't miss things:**
  - Ask in your own words, and misspellings are fine.
  - Questions like "everything about video ads" return the complete list with a count ("showing 1–10 of 23"), not just a top few.
- **Use it from anywhere:**
  - the Telegram bot (`@yourbot query` in any chat),
  - the web app (email + password),
  - Claude Code / Cursor / Gemini CLI over MCP (team: `/api/mcp` with a key; open catalogue: `/api/public/mcp`, no key),
  - a REST API.

## How it works

```
 Teammates ──share──▶ Telegram bot ─┐
                                    ▼
 Web app · MCP · REST ◀──▶  Next.js app (Vercel or any Node host) ◀──▶ Postgres
                                    ▲
                    jobs queue      │
                                    ▼
             Worker on a Mac: yt-dlp + ffmpeg + whisper.cpp,
             driven by a Claude Code session that identifies and verifies each item
```

- **`web/`**: one Next.js 16 app. It holds the bot webhook, the web UI, the MCP servers (`/api/mcp` for the team, `/api/public/mcp` for the open catalogue), the REST API (`/api/v1`), the worker API and the scheduled jobs.
- **`web/worker/`**: the worker CLI (`pnpm worker …`).
  - It runs on a machine you own, because Instagram blocks downloads from cloud servers.
  - It uses `yt-dlp`, `ffmpeg` and `whisper-cli`. No Python, no ML libraries.
  - A Claude Code session follows [WORKER.md](WORKER.md) to process each job.
- **`db/migrations/`**: Postgres schema (plain SQL).

## Docs

| Guide | For |
|---|---|
| [Set up your own Orphic](docs/self-hosting.md) | Whoever runs it: create the bot, run locally, set up the worker, deploy |
| [Using Orphic](docs/using-orphic.md) | Admins (inviting people, removing access) and teammates (saving, searching, web, AI tools) |
| [Security](docs/security.md) | What's protected, how, and what to know before you deploy |
| [WORKER.md](WORKER.md) | The procedure the Claude Code worker follows for each job |
| [docs/worker-api.md](docs/worker-api.md) | The worker ↔ server API |
| [docs/research.md](docs/research.md) | Background research behind the design |
| [AGENTS.md](AGENTS.md) | For AI coding agents working on this repo |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [SECURITY.md](SECURITY.md) · [TRADEMARK.md](TRADEMARK.md) | Contributing, reporting vulnerabilities, using the name |

## Quick start (local)

Needs: Node 24 + pnpm, Docker, `yt-dlp`, `ffmpeg`, whisper.cpp with a model, Claude Code, and a Telegram bot token. Details are in [docs/self-hosting.md](docs/self-hosting.md).

```bash
git clone <this repo> orphic && cd orphic
docker compose up -d                      # Postgres + pgvector on localhost:54329
cd web && nvm use && pnpm install
cp .env.example .env.local                # add your bot token, bot username, whisper model path
pnpm db:migrate
pnpm orphic setup "My Team"               # prints your owner invite link + the worker key
pnpm dev                                  # web app on http://localhost:3005
pnpm bot:poll                             # Telegram bot (local mode)
```

Open the owner invite link in Telegram. Then, in a Claude Code session in this repo, say *"process the Orphic queue"* and it will follow [WORKER.md](WORKER.md).

## License

MIT. See [LICENSE](LICENSE). The name and logo are covered by [TRADEMARK.md](TRADEMARK.md).

Orphic downloads publicly visible posts that your teammates share with it, for your team's internal reference. You're responsible for using it in line with Instagram's terms and the creators' rights. Don't republish creators' content.
