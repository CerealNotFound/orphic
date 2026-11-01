# Using Orphic

Two parts: **for admins** (owner and admins: inviting people, managing access) and **for everyone** (saving, searching, the web app, AI tools).

---

# For admins

## Roles

| Role | Who | Can |
|---|---|---|
| **Owner** | Whoever opened the first invite link after `pnpm orphic setup` | Everything an admin can. Can't be removed |
| **Admin** | Invited with an admin invite, or promoted | Invite people, remove access, set the team group |
| **Member** | Everyone else | Save, search, rate, use the web app and AI tools |

Everyone in the team can see everything the team has saved. Orphic is a shared library, not private notes.

## Invite someone who uses Telegram (recommended)

Telegram is where saving happens (Instagram → Share → Telegram → Orphic), so this is the best option for anyone who'll save reels.

1. Get a team invite link (only the team owner can make one), whichever way is easiest:
   - in Telegram, send `/invite` to the bot;
   - in the web app, go to **Team → Create invite link**;
   - in a terminal, `cd web && pnpm orphic invite`.
2. Send the link (`https://t.me/<yourbot>?start=…`) to your teammate. One link works for up to 50 people.
3. They tap it, Telegram opens the bot, they press **Start**, and they're in. The bot says hi and explains how to use it.

## Invite someone who'll only use the web (no Telegram)

For people who just want to search, from a laptop or phone browser.

1. As the team owner, go to **Team → Web only (no Telegram)** in the web app.
2. Enter their **name** and **email**, then press **Create web invite**.
3. Copy the link it shows and send it to them **privately** (a DM or email to that person only). The link:
   - works **once**;
   - expires after **7 days**;
   - lets whoever opens it create the login, so don't post it in a group.
4. They open it, choose a password, and land in Orphic. Next time they sign in at `/signin` with that email and password.

If the link expired or got lost, create a web invite again for the same email; it issues a fresh link.

## Give a Telegram user web access too

Teammates already on Telegram send `/web` to the bot. It replies with a personal link (valid 30 minutes) where they create their email and password once. **Forgot your password?** Send `/web` again and open the link: it lets you set a new one (this signs you out everywhere else).

## Remove someone's access

**Team → Remove access** next to their name. Immediately:
- the bot stops responding to them;
- their web sessions are signed out and they can't sign back in;
- their API keys (for AI tools) stop working.

Everything they saved stays in Orphic, credited to them. To give access back, invite them again: a new web invite, or the Telegram invite link.

## Set the team group

Add the bot to your team's Telegram group, then send `/setgroup` there (owner/admin). Every Monday, Orphic posts a digest: what the team saved, the most-saved tools, new categories.

## Items waiting on a creator's DM

When a reel says "comment X and I'll DM you the link" and the link isn't findable, Orphic saves the item as **⏳ Waiting on DM** and gives the person who saved it a to-do. See them on the web at **Pending**, or with `/pending` in Telegram.

- **The DM arrived:** forward the link (or a screenshot of the DM) to the bot. Orphic attaches it to the right item.
- **The DM never came** (the creator's automation is broken): press **🚫 DM never came**, on the web, on the Telegram card, or in `/pending`. The to-do closes and reminders stop. The item stays searchable, marked "DM never came". If the link turns up later, forwarding it still works.

---

# For everyone

## Save something

| What you have | What to do |
|---|---|
| A reel or post on Instagram | **Share → Telegram → Orphic → Send.** Add a note in the same message if you like ("for the client ads project") |
| A link (GitHub, website, Google Doc, Drive file, Notion…) | Paste it to the bot |
| A PDF or document (PDF, Word, .rtf, .odt, .txt, .md, .csv; up to 20 MB) | Send it to the bot as a file. Orphic reads it and keeps a private copy. Bigger files: upload to Google Drive and send the link |
| A screenshot (of a reel, a DM, a tweet) | Send the image to the bot |
| Several at once | Send them one after another; they queue up |

**Saved copies:** for links (Google Docs, Drive files, Notion and other pages), Orphic also keeps a private copy: a PDF of a Google Doc, the original file from Drive, the page text, and for Notion the **whole site**: every page and sub-page, with all its images, videos and files, in one "🌐 Full copy" page that works even if the original is gone. If the creator later deletes the doc or revokes access, your team still has it. Find the copies on the item's page under **Where it came from → 🔒 Saved copies**. Only signed-in teammates can open them.

The bot replies **📥 Got it (#12)** straight away. Within a few minutes the message turns into a card with:
- the tool's name and what it does;
- **🔗 the verified link**;
- tags, and who else saved it.

If Orphic isn't sure what the reel is about, it asks you with tap buttons.

Card buttons:
- **👍 Works / 👎 Meh**: tell the team whether it's any good. Ratings move items up or down in search.
- **🔗 Open**: the link.
- **✅ I commented / 🚫 DM never came**: for "comment X" reels.

## Search

- **Telegram:** just type what you're looking for: `tool for anime videos`, `remotion`, `how to make ads with claude`. Misspellings are fine. You get the best matches first, with a count like "showing 1–5 of 9", and a **More** button.
- **Any Telegram chat:** type `@<yourbot> claude skills` in any conversation, pick a result, and it's shared into that chat.
- **Web:** results update as you type, and you can filter by category and tag. Every item has a page with its link, sources (the original reels), who saved it and ratings.

Search understands meaning beyond exact words, because Orphic writes related terms for every item when it saves it. "japanese animation" finds an anime tool, and "make money selling videos" finds a guide about selling video work.

## Telegram commands

| Command | What it does |
|---|---|
| `/recent` | Latest saves from the team |
| `/pending` | Your "comment X" to-dos, with 🚫 buttons |
| `/search <words>` | Search (or just type the words) |
| `/web` | Personal link to set up your web login |
| `/invite` | (owner only) Invite link for a teammate |
| `/setgroup` | (in a group, admins) make it the team group |
| `/help` | How to use Orphic |

## The web app

Sign in at `<your Orphic URL>/signin` with your email and password.

| Page | What's there |
|---|---|
| **Search** (home) | Search box, category/tag filters, the team feed |
| **Tool pages** | Link, summary, use cases, sources, who saved it, 👍/👎 |
| **Pending** | Your "comment X" to-dos and everything the team is waiting on |
| **Team** | Members; invites and access (admins) |
| **Connect AI** | Your API key and setup for Claude Code, Cursor and other AI tools |

The pages refresh themselves every 15 seconds, so new saves appear without reloading.

## Use Orphic from your AI tools

On the web app's **Connect AI** page, press **Create my API key** and copy it. It's shown once.

**Claude Code:**
```bash
claude mcp add --transport http orphic https://<your-orphic>/api/mcp --header "Authorization: Bearer <key>"
```
Then ask Claude things like "what do we have in Orphic for anime videos?" It can search, list, read details, save links and rate items.

**Cursor** (`~/.cursor/mcp.json`) / **Gemini CLI** (`settings.json`): the exact snippets are on the Connect AI page.

**Any agent or script (agent mode):** the library as Markdown. By default a short list (one line per item, with the size of the full version), so an agent reads the list first and fetches only what it needs.
```bash
curl -H "Authorization: Bearer <key>" https://<your-orphic>/api/v1/agent.md                    # everything, one line each
curl -H "Authorization: Bearer <key>" "https://<your-orphic>/api/v1/agent.md?q=anime"          # matches only
curl -H "Authorization: Bearer <key>" "https://<your-orphic>/api/v1/agent.md?item=<slug>"      # one item in full
curl -H "Authorization: Bearer <key>" "https://<your-orphic>/api/v1/agent.md?detail=full"      # every item in full (large)
```
The MCP tool `read_library` works the same way (`detail: "full"` for everything).
Point an agent at `https://<your-orphic>/llms.txt`; it explains the API to the agent.

Search results say how each item matched (`matched_by`: words, name or meaning). When nothing matches the words or a name, the AI is told the results are only loosely related, so it doesn't present them as answers. Drive, Google Docs and Notion links come with the saved copy, since their owner can take the original down.

### The open catalogue (no key)

Agents without MCP can read the catalogue as Markdown pages laid out as a map, each saying what the next step costs:

| Page | What it holds |
|---|---|
| `/llms.txt` | Start here: every way in and its size |
| `/explore.md` | Categories, counts, top tools |
| `/explore/category/{category}.md` | One line per tool |
| `/explore/{slug}.md` | One tool in full (with its saved files, if any) |
| `/llms-full.txt`, `/catalogue.json` | Everything in one request |

Asking for Markdown on a normal page (`Accept: text/markdown`) returns the Markdown version too. All of these are prebuilt and cached, so they cost nothing to serve.

Anyone can connect an AI to the public part of the catalogue, with no key or account:
```bash
claude mcp add --transport http orphic https://<your-orphic>/api/public/mcp
```
Tools: `search_tools`, `get_tool`, `list_tools` (one call can list the whole catalogue), `list_categories`. It's read-only, costs nothing per call (no AI or embedding calls), and `PUBLIC_API=off` pauses it along with the public search API.

Keep your key private: anyone with it can read your team's library. If it leaks, ask an admin to remove and re-invite you, which revokes your keys.
