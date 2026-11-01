# Orphic: design research

> Background research behind Orphic's design (October 2026). Some choices changed during the build; the README and docs/ describe what is actually implemented: Telegram bot, one Next.js app, Postgres, a TypeScript worker driven by Claude Code, and keyword search with Claude-written search terms (no embedding service needed).

**What Orphic is:** a shared team memory for useful things people spot in reels. Anyone on the team shares a reel, link or screenshot to Orphic. Orphic works out the tool or resource, finds the real link, and saves it. Anyone can then ask about it from anywhere: the chat bot, their own Claude or ChatGPT, or the Orphic web app. It is built so it could later be sold to other teams.

Research date: 2026-10-30. Points marked ⚠ came from a single, vendor or secondary source.

---

## TL;DR: the stack

| Layer | Choice | Why |
|---|---|---|
| Capture channel | **Shared Telegram bot** (a direct chat per person, plus a team group for the digest) | 2-tap share from Instagram. Buttons, in-chat search, voice notes and the in-Telegram search page (Mini App) are all free. Your Telegram account is your login, so no passwords. |
| Bot hosting | **Telegram webhook on the hosted service** | The bot is always online. It confirms in about 1 s and answers search questions 24/7, even when the Mac is off. |
| Processing | **Worker on the owner's Mac**, run with Claude Code | Instagram blocks downloads from cloud servers. Transcription is local and free. Jobs wait in the database until the Mac picks them up. |
| Download | **yt-dlp, no login** | Verified on this Mac: full reel in 9 s, plus caption, uploader and comments. |
| Transcription | **whisper.cpp (`whisper-cli`) already on the Mac**, with the existing multilingual `ggml-medium.bin` | No new installs. Verified: an 18 s reel goes through download, keyframes and transcription in ~19 s. |
| On-screen text | ffmpeg keyframes (up to 8 per reel); **Claude Code reads the frames itself** | Tool names and URLs often appear only on screen. No OCR library needed. |
| Database | **Neon Postgres** (via the Vercel Marketplace) | One database for filters, keyword search, fuzzy names and vectors. Rows are separated per team at the database level (Postgres row-level security), so it's ready to sell. The free plan is enough to start. |
| Search | Keyword search, fuzzy name matching and vector search, combined in **one SQL query**; "list everything" queries use plain filters with **no cutoff** | High recall: nothing relevant gets silently dropped. |
| Embeddings | **Voyage `voyage-4`, 1024 dims** | $0.06 per 1M tokens, first 200M free. Anthropic's recommended embedding provider. Same model on the Mac and the server. |
| Query surfaces | **Orphic web app** (Next.js) + **remote MCP server** (`/mcp`) + **REST API** (`/api`) + **chat bot** | Every teammate queries from their own client. The server only searches and returns items; it makes no AI calls. |
| Team sign-in for AI clients | **Better Auth** (`mcp()` plugin plus Google social login), limited to the team's emails or domain | Gives the hosted service the OAuth endpoints Claude, Cursor and Gemini CLI connectors need, including CIMD and DCR client registration. |
| Hosted code | **One Next.js app (App Router, TypeScript) on Vercel**. It holds the web UI, the Telegram bot webhook (`/api/telegram`; `/api/instagram` added later), the REST API, and the MCP server via Vercel's `mcp-handler` with `withMcpAuth`. Better Auth runs inside the same app for web login and connector sign-in. | One deploy, one codebase, one login system for the web app and AI clients. Better Auth and `mcp-handler` both support Next.js directly, which removes the Fastify sign-in wiring. The Mac worker is a TypeScript script in the same project (`web/worker/cli.ts`, run with `pnpm worker`) that calls yt-dlp, ffmpeg and whisper-cli. No Python, no heavy dependencies. |
| Media | **No videos stored.** 3–6 keyframes in Vercel Blob | Cheap, and lowest copyright exposure. |

---

## 1. The product

### 1.1 Core loop
1. **Capture.** A teammate taps Share on a reel and picks Orphic. They can add a note ("for the ads project"), but it's optional.
2. **Orphic does the work.**
   - It confirms instantly: *"Got it, #214"*.
   - About 10–60 s later it **edits that same message** into a card: tool name, verified link, one-line summary, category, and *"also saved by Riya"*.
3. **Creator-only resources** ("comment AI for the link") become a task for whoever sent the reel.
   - They get an *[I commented]* button.
   - Forwarding the DM link or a screenshot closes the task, and the resource is archived.
   - At most one reminder a day.
4. **Ask from anywhere.**
   - A direct message to the bot.
   - `@orphic …` typed in any Telegram chat.
   - A mention in the team group.
   - A voice note.
   - The Orphic web app (also usable on mobile; can open inside Telegram as a Mini App).
   - Their own Claude or ChatGPT through the Orphic connector.

### 1.2 Team features
- **Duplicates merge.** Five people saving the same tool become one tool page with five saves. *"Already saved by Riya, added your save"* comes back instantly.
- **Save count = signal.** Tools saved by several people rank higher and show up in the digest.
- **"Tried it" ratings.** One tap on a card: 👍 works / 👎 overhyped. Ratings affect ranking, so the pile of links becomes the team's judgment.
- **Status on every item:** ✅ link verified, ⏳ waiting on the DM link, ❓ couldn't identify. Nothing ends up silently half-saved.
- **Collections** by project or use case.
- **Weekly digest** in the team group: top new tools by category and the most-saved items.
- **Light nudges:** *"You saved an AI ad tool. The team also has Arcads and Higgsfield, both 👍."*

### 1.3 Making it effortless for teammates
- **Nothing to set up.** Join with one invite link (`t.me/OrphicBot?start=<code>`). Connecting Claude or ChatGPT is optional, and the Claude connector is set up once.
- **No forms, no "confirm?".** Questions only when truly unsure, and then as tap buttons: *[Higgsfield] [Kling] [Something else]*.
- **One message per save**, edited in place, never a stream of status messages.
- **Batch forwarding** works: five reels in a row just queue up.
- **Answers are short:** the best match first in 3 lines with the link, then *[and 4 more]*.
- **Speed:**
  - List questions come straight from the database with no AI step, so they're instant and complete.
  - Summaries and categories are written once at save time, not at question time.
  - Fast path at save time: if the caption or thumbnail already names the tool clearly, the card goes out first and the transcript fills in details afterwards.

---

## 2. Architecture

```
  Teammates' phones                          Teammates' AI clients
  Instagram ─share─▶ Telegram                Claude (web/desktop/mobile), Claude Code,
                       │                     Cursor, Gemini CLI, ChatGPT (plan-dependent)
                       ▼                                 │  MCP + Google sign-in
  ┌────────────────────── Orphic Next.js app (Vercel, TypeScript) ───────────────────────────┐
  │ /telegram  webhook: confirm, queue capture jobs, answer searches, inline mode, buttons    │
  │ /mcp  MCP server (mcp-handler + OAuth)   /api  REST   /  web app (search, tools, saves)  │
  │ cron       weekly digest, reminders                                                       │
  └──────────────────────────────────────┬────────────────────────────────────────────────────┘
                                         │
                         ┌───────────────▼────────────────┐
                         │ Neon Postgres                  │  items, entities, saves, ratings,
                         │ text search + pg_trgm + vector │  tasks, jobs queue, members, workspaces
                         └───────────────▲────────────────┘
                                         │ claims jobs / writes results (scoped API key)
                   ┌─────────────────────┴──────────────────────┐
                   │ Mac worker (Claude Code)                   │
                   │ yt-dlp → ffmpeg → whisper-cli → keyframes  │
                   │ → Claude: identify + verify + summarise    │
                   │ → POST /api/ingest → edit Telegram card    │
                   └────────────────────────────────────────────┘
```

- **The bot never depends on the Mac being on.** Captures queue up in Postgres, and searches are answered by the hosted service.
- **The Mac worker exposes a simple job interface** that Claude Code drives (owner's setup):
  - `orphic jobs watch` prints one line per new job;
  - `orphic process <job>` runs the pipeline;
  - `orphic reply <job> <card>` posts the result.
- **One write path.** The Mac writes only through `POST /api/ingest` with an `ingest:write` key, never with a direct database login. Dedup and entity linking happen in one place, on the server.
- **Model-agnostic.** The pipeline steps are plain code. Claude is used for identification, verification and summaries through one small interface (`identify(capture) -> candidates`), so it can be swapped for another model later. Query surfaces use no AI at all.

---

## 3. Capture pipeline (Mac worker)

| Step | What | Tools / fallbacks |
|---|---|---|
| 1. Normalize | Reduce the reel URL to its shortcode (strip `?igsh=`). If that shortcode already exists in the workspace, just add the save and reply instantly. For DM links: resolve redirects, strip tracking parameters. For screenshots: Claude reads the image. | |
| 2. Fetch | `yt-dlp -J --write-comments --write-thumbnail`, no login | Space fetches out; run `yt-dlp -U` weekly. If yt-dlp breaks: a downloader site driven by a headless browser (§3.1), then cookies from a throwaway Instagram account |
| 3. Fast path | Caption + thumbnail OCR, then Claude. If the tool is named clearly, send the card now. | |
| 4. Audio | ffmpeg to 16 kHz mono, then `whisper-cli` (existing ggml-medium model) | |
| 5. Frames | Up to 8 evenly spaced keyframes plus the thumbnail. Claude Code reads them for on-screen names, URLs, logos and app screens. | |
| 6. Identify | Claude extracts candidates: name, type (tool / prompt pack / template / workflow / repo), evidence, `is_creator_owned` | Structured JSON |
| 7. Verify | Web search for "\<name\> official", check the domain matches the name, fetch the page to confirm it matches the reel's claims | Confidence goes up when the name appears in several sources. **Ask with buttons if confidence < 0.7 or there are several candidates.** |
| 8. Classify | Public tool: link it to the tool's page. Creator resource: ⏳ task for the sender. Before asking, check the caption, comments, the creator's bio or Linktree, and a web search. | |
| 9. Archive | For DM links: fetch and keep a copy | Notion: Jina Reader (`r.jina.ai/<url>`). Google Docs: `/export?format=txt`. Public Drive/Gumroad files: download. Email-gated: mark "needs user". |
| 10. Store | Summary, use cases, category and tags written in English; embedding; keyframes to Blob; edit the Telegram card | |

**Verified on this Mac:** metadata in 3.3 s; full download of an 18 s reel (4 MB) in 9.2 s; no login, no cookies.

### 3.1 Downloader websites (fastvideosave.net and similar)
- **No public API.** fastvideosave encrypts the reel URL in the browser with AES-CBC (the key is in its JavaScript) and sends it to a hidden endpoint, `api.getrequest.dev`. That's built to stop scripts.
- **Under the hood they scrape Instagram the same way yt-dlp does.**
- **Decision:** a `Downloader` interface with yt-dlp first. Add a headless-browser fallback that fills their form like a person would, only if yt-dlp starts failing.

---

## 4. Data and search

### 4.1 Schema (team-ready from day 1)
- **Tenancy and people:**
  - `workspaces`
  - `members(workspace_id, telegram_user_id, email, role)`
  - `invites`
  - `api_keys(prefix, sha256_hash, scopes[], revoked_at)`
- **Content:**
  - `captures`: one per reel, link or screenshot. Fields: `workspace_id, source_url, shortcode, creator_handle, caption, transcript, ocr, comments_excerpt, note, status, confidence, captured_at`.
  - `saves(capture_id, member_id, note, saved_at)`: who saved what. Duplicates add a save instead of a new capture.
  - `entities`: tool, workflow, prompt or template pages. Fields: `name, aliases[], canonical_url, summary, use_cases[], category, tags[], pricing`.
  - `capture_entities(role: primary | mentioned | alternative)`.
- **Team features:**
  - `ratings(entity_id, member_id, value, comment)`
  - `tasks` (pending-DM, needs-user)
  - `collections`, `collection_items`
- **Plumbing:**
  - `jobs` (queue: `queued | processing | done | failed`, attempts, telegram message ID)
  - `embeddings(object_id, model, dim, vector halfvec(1024))`
- **Isolation:** every table carries `workspace_id`, and Postgres row-level security enforces it. Each request sets the workspace from its token, so one team can never see another team's rows.
- **Dedup:**
  1. Shortcode unique per workspace.
  2. Entities: normalize the URL, match aliases, check embedding similarity > 0.9, then Claude confirms the merge.
- **Taxonomy:**
  - A fixed list of 15–30 categories.
  - Free-form tags go through an alias table, and new tags are "proposed" until the weekly cleanup accepts them.

### 4.2 Search: built so answers don't miss things
1. **"List everything about X"**: a plain SQL filter on category, tags and entity, plus keyword search. Return **all** matches with `total_matches`, paginated. **Never cut off at a top-k.**
2. **"That tool that did Y" / "best tool for X"**: one SQL function combines three ranked lists using reciprocal rank fusion, so items that rank well in any list rise to the top:
   - keyword search (`tsvector` + `websearch_to_tsquery`, ranked by `ts_rank_cd`);
   - `pg_trgm` similarity on tool names and aliases, for misspellings;
   - vector similarity, computed **exactly** over all rows rather than with an approximate index. At under ~50k rows that's still fast, and approximate indexes can drop matches when filters apply.

   Return the top 50, with save count and rating as tie-breakers. The AI client, or the bot's card list, presents the best ones.
3. **Every response carries** `total_matches`, `returned` and `next_cursor`, plus a line like *"showing 10 of 43"*, so no client mistakes a page for everything.
4. **Hinglish:** summaries and use cases are written in English at save time and embedded. The raw transcript stays searchable by keyword.

**Why this works:** in Anthropic's Contextual Retrieval study, retrieval failures dropped from 5.7% to 2.9% when keyword and vector search were combined, and to 1.9% with reranking. True BM25 extensions aren't needed at this size: ParadeDB `pg_search` is AGPL and Neon stopped offering it to new projects in March 2026.

### 4.3 Measuring recall
- A **golden set of 40–60 real team questions** with hand-labelled correct items, including list-style and Hinglish questions.
- Track recall@20, recall@50, and complete recall on list questions, re-run on every change.
- Target recall@50 ≥ 0.95.

---

## 5. Team access from anywhere

### 5.1 AI clients via the remote MCP server

| Client | Who can use it | How to connect | Mobile |
|---|---|---|---|
| Claude (web / desktop / mobile) | Free (1 custom connector), Pro, Max, Team, Enterprise | Settings → Connectors → add the URL, then sign in with Google. **On Claude Team, the owner adds it once for the whole org** and each member clicks Connect. | Yes. Connect on web or desktop and it appears in the apps. |
| Claude Code | Any | `claude mcp add --transport http orphic https://<host>/mcp` | n/a |
| Cursor / Gemini CLI | Any | URL in `mcp.json` / `settings.json`; OAuth | n/a |
| ChatGPT | ⚠ Sources conflict: Business/Enterprise/Edu for sure; Pro read-only; Plus unclear | Developer mode → custom connector (set up on web) | Workspace apps reportedly work in mobile chats ⚠ |

**What the server must implement for Claude connectors:**
- A `401` with `WWW-Authenticate: Bearer resource_metadata=…` for unauthenticated requests.
- Protected Resource Metadata (RFC 9728).
- PKCE S256.
- Both CIMD and DCR client registration.
- Callback `https://claude.ai/api/mcp/auth_callback`, plus localhost callbacks for Claude Code.
- Under 10 s on the auth endpoints.

**Better Auth's `mcp()` plugin** (built on its OAuth 2.1 provider) handles this: protected resource metadata, PKCE, CIMD, plus DCR when enabled. Google is the login through Better Auth's social sign-in. Restrict access with a team email allowlist, or a Workspace "Internal" consent screen if the team uses Google Workspace. Better Auth mounts as a Next.js route handler (`/api/auth/[...all]`), and `mcp-handler`'s `withMcpAuth` checks its tokens on `/mcp`. ⚠ Better Auth's MCP plugin is changing: the old plugin is being deprecated and the new one is documented for v1.8 beta, so pin a version and test against Claude's connector flow first. Fallbacks: WorkOS AuthKit, or Clerk. When selling: WorkOS for organizations and SSO.

### 5.2 MCP tools (kept small)
- **Read tools**, all marked `readOnlyHint` so ChatGPT doesn't ask for confirmation:
  - `search_items(query, filters, limit, cursor, detail=concise|full)`: fuzzy search with totals.
  - `list_items(category, tags, entity, saved_by, since, status, cursor)`: exhaustive, with totals.
  - `get_item(id)`: full details, saves, ratings, sources.
  - `list_facets()`: categories, tools and tags with counts, so the model knows what exists.
- **Write tools:**
  - `save_link(url, note)`: capture from inside Claude.
  - `rate(entity, value, comment)`.
- **Result size:** default responses stay under ~8k tokens (Claude Code warns at 10k tokens and caps at 25k; claude.ai caps at ~150k characters).
- **Format:** readable fields, not bare IDs. Errors say what to change.

### 5.3 Without AI
- **Telegram:** direct messages, inline `@orphic` search in any chat, and group mentions. These answer straight from the search service in about 1 s.
- **Orphic web app** (Next.js), behind the same Google sign-in:
  - Search with filters and full lists ("showing all 43").
  - Tool pages: link, summary, saves, ratings, the source reels with keyframes.
  - Team feed of recent saves, collections, and the queue of ⏳ items waiting on a DM link.
  - It also opens inside Telegram as a Mini App, logged in through Telegram's login data.
- **REST API** for anything else (Slack later, scripts, a web page).

---

## 6. Hosting and costs

| Item | Choice | Cost at team scale |
|---|---|---|
| Hosted service | Vercel Pro, Next.js on Fluid compute | $20/mo per seat, usage credit included; idle traffic costs about $0 |
| Database | Neon (free: 100 CU-hours/mo, scales to zero after 5 min; Launch: $0.106/CU-hour, $0.35/GB-month) | $0 to start |
| Embeddings | Voyage `voyage-4` | First 200M tokens free; 10k items cost well under $1 |
| Keyframes | Vercel Blob | Pennies |
| Transcription, OCR, download | On the Mac | $0 |

Vercel's Hobby plan is non-commercial only, so use Pro if Orphic is ever sold. Neon's free plan can't disable scale-to-zero, so expect a short cold start after idle periods ⚠ (not measured).

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Instagram changes break yt-dlp (happened several times June–Oct 2026) | Weekly `yt-dlp -U`; headless-browser downloader fallback; throwaway-account cookies as the last resort; a clear failure card with a *[retry]* button |
| Cloud IPs blocked by Instagram | Downloads stay on the Mac |
| Mac off means captures wait | Jobs queue in Postgres and the bot tells people *"queued, will process shortly"*. Searches keep working. |
| Hinglish garbles tool names | Cross-check against on-screen text and caption; button-confirm when unsure |
| Lookalike tools, affiliate or redirect links | Prefer the official domain; check the page matches the claims |
| DM resources expire or are email-gated | Archive immediately; "needs user" status |
| Tags turn into a mess over time | Fixed categories, tag aliases, weekly cleanup job |
| **Selling later** | Instagram's terms ban automated collection without permission. Transcripts and videos are creators' content. A sellable version should capture on the user's side (share extension or the official Instagram Messaging API, whose webhook includes `ig_reel` attachments), store only derived notes, tool links and the permalink (no raw transcripts or video for customers), and get a legal review before launch. |

---

## 8. Build order

1. **Database:** Neon schema, row-level security, the combined search SQL function, seed categories, golden question set and recall script.
2. **Next.js app, backend first:** bot webhook (confirm, queue, search answers, buttons, invite links), `/api` with ingest and search, `/mcp` (`mcp-handler`) with Better Auth Google sign-in. Shared request/response schemas (zod, exported as JSON Schema) so the worker uses the same contract.
3. **Mac worker:** `pnpm worker watch / claim / extract / submit` (yt-dlp, ffmpeg, whisper-cli; Claude Code identifies and verifies). Runbook: WORKER.md.
4. **Team features:** dedup notices, ratings, pending-DM tasks and reminders, weekly digest (Vercel cron).
5. **Web app UI:** search, tool pages, team feed, collections, pending queue.
6. **Later:** Instagram DM capture, Slack, collections UI, multi-team onboarding, WorkOS, the "sellable" data changes.

---

## 9. Phase 2: Instagram DM bot (the 2-tap flow)

Researched 2026-10-30. Same Next.js app, new route `/api/instagram`. It feeds the same job queue, so nothing else changes.

**Setup (human):**
1. Create a dedicated Instagram account for the bot and switch it to a **Business** account.
2. Create a Meta developer account, then a **Business-type app** with the Instagram messaging use case. In the dashboard, open "API setup with Instagram business login", add the bot account and **Generate token** (long-lived, 60 days).
3. Permissions: `instagram_business_basic` and `instagram_business_manage_messages`.
4. Webhook: callback URL plus verify token. Fields: `messages`, `messaging_postbacks`, `messaging_seen`.
5. In the bot's Instagram app: Settings → Messages → Connected tools → **Allow access to messages**.
6. **Publish the app.** Meta says it must be Live to deliver webhooks.
7. Add each teammate as an **Instagram Tester**. They accept in Instagram → Settings → Apps and websites → Tester invites ⚠.

**Code:**
- Handle the GET verify challenge.
- Call `POST /<IG_ID>/subscribed_apps?subscribed_fields=messages,…`. Without it, no webhooks arrive.
- Check `X-Hub-Signature-256` against the raw body (`await req.text()`). Test both the Instagram and Meta app secrets ⚠.
- Return 200 fast and do the work in `after()`. Deduplicate on `mid` (Meta retries for up to 36 h).
- Weekly cron to refresh the token.

**Payloads:**
- Shared reels arrive as `ig_reel` with a title, a `url` (reportedly a CDN video link ⚠ expiry unknown, so download it immediately, with yt-dlp as the fallback) and a video ID.
- Posts arrive as `ig_post` (the old `share` type ended 1 Feb 2026).
- Screenshots arrive as `image`, voice notes as `audio`, links as `text`.
- GIFs, stickers and disappearing media send nothing.

**Replies:**
- Text up to 1,000 bytes; up to 13 quick replies (not shown on desktop); templates, 4 ice breakers, a persistent menu, typing indicator.
- **No message editing**, so the "confirm, then edit into a card" pattern becomes "confirm, then send the card".
- Replies are only possible within 24 h of the teammate's last message.

**Main risk:**
- Meta says webhooks are only sent "if the person using your app has a role on the app".
- An n8n community thread (Aug–Oct 2026, still unresolved) reports that DMs from testers never arrived even though Meta's test button worked. If that happens, the way out is App Review plus Business Verification, roughly 1–4 weeks ⚠.
- **Plan:** a 2-hour test with 2 tester teammates before committing.

**If WhatsApp is ever wanted:**
- It needs a SIM that has never been on WhatsApp (a cheap prepaid one works).
- No App Review needed. Display-name review takes about 1–2 days.
- The free test number allows only 5 recipients.
- Replies are free up to 1,000 a month, then about ₹0.115 each ⚠ (under ₹500/month for 10 people).
- A shared reel arrives as a plain link, and the bot can show only 3 buttons per message.

---

## Key sources
- Claude custom connectors: https://claude.com/docs/connectors/custom · auth: https://claude.com/docs/connectors/building/authentication
- Team/Enterprise org connectors: https://support.claude.com/en/articles/11175166
- Claude Code MCP: https://code.claude.com/docs/en/mcp
- MCP auth spec (2026-07-28): https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization
- FastMCP Google auth: https://gofastmcp.com/integrations/google · OAuth proxy: https://gofastmcp.com/servers/auth/oauth-proxy
- Writing tools for agents: https://www.anthropic.com/engineering/writing-tools-for-agents
- Cursor MCP: https://cursor.com/docs/mcp · Gemini CLI MCP: https://geminicli.com/docs/tools/mcp-server/
- OpenAI custom MCP: https://developers.openai.com/api/docs/guides/custom-mcp-server.md
- Neon pricing: https://neon.com/pricing · extensions: https://neon.com/docs/extensions/pg-extensions · pg_search change: https://neon.com/docs/changelog/2026-04-03
- Supabase hybrid search SQL (reference): https://supabase.com/docs/guides/ai/hybrid-search
- Voyage pricing: https://docs.voyageai.com/docs/pricing
- MCP on Vercel (`mcp-handler`): https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel · limits: https://vercel.com/docs/functions/limitations
- Better Auth MCP plugin: https://better-auth.com/docs/plugins/mcp
- Anthropic Contextual Retrieval: https://www.anthropic.com/news/contextual-retrieval
- Karpathy LLM Wiki: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Instagram Messaging changelog (`ig_reel`): https://developers.facebook.com/documentation/business-messaging/instagram-messaging/changelog/
- Instagram webhooks setup: https://developers.facebook.com/documentation/instagram-platform/webhooks/setup · messaging webhooks: https://developers.facebook.com/documentation/business-messaging/instagram-messaging/webhooks · app review: https://developers.facebook.com/documentation/instagram-platform/app-review.md
- Tester webhook issue (n8n, 2026): https://community.n8n.io/t/instagram-dm-webhook-verified-and-subscribed-but-real-dms-never-reach-n8n-curl-works/310460
- WhatsApp pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing · limits: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
- yt-dlp Instagram extractor: https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/instagram.py
- Telegram Bot API: https://core.telegram.org/bots/api
- Prior art: n8n reel→Telegram template https://n8n.io/workflows/20912 · SpillTheReel https://dev.to/main_charachter/escaping-the-algorithm-how-we-gave-ai-a-memory-and-built-a-second-brain-for-instagram-reels-28j7

**Still unverified ⚠:**
- Which ChatGPT plans can use custom connectors.
- Better Auth's MCP plugin (v1.8 beta) working end to end with Claude's connector flow (WorkOS or Clerk is the fallback).
- Neon cold-start time.
- Whether the Instagram DM `ig_reel` URL is downloadable.
- whisper.cpp medium speed on longer, speech-heavy reels (only a music-only reel tested so far).
