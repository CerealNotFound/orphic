# Plan: open-source Orphic + a free public catalogue

Status: **plan only, nothing built.** Written 1 Nov 2026, updated the same day for the owner's direction:

> **A free, completely open source project built to go viral. Zero authentication: no accounts, keys, OAuth or sign-in to search or read, for people or AIs.**

Openness is limited only by what we're *allowed* to publish (creators' own content isn't ours) and by cost (caching and rate limits instead of logins).

## What we're doing

1. **Open-source the code.** Anyone can run their own Orphic for their team (it's already MIT-licensed, with a trademark policy).
2. **A free, fully open catalogue.** Anyone, and any AI, can search and read every tool found, with **no sign-in, no key, no account** on the website, the API, the MCP server or the bulk download.

Not in scope: hosting other people's teams on our deployment. The capture side (the worker on a Mac plus Claude usage) costs money for every item, so we don't run it for strangers. See **Part 4** for open *submissions*, which is a separate decision.

## Guiding rules

- **Publish only what we wrote, plus facts.** Tool name, official link, our summary, use cases, tags, category and pricing are ours or facts. Creators' content (captions, transcripts, video frames, page copies, PDFs, Drive files) stays private to the team, always.
- **Credit and link creators.** Show the source reel's permalink and the creator's handle, and send traffic to them. Never re-host their content.
- **Teammates stay private.** No "saved by" names, notes or individual ratings in public. Counts are fine.
- **Open by default, hideable.** Every item that passes the rules below is public automatically, and an admin can hide any item at once. Creators get a takedown route.
- **No logins for reading, ever.** Abuse is handled by caching, rate limits and a bulk download, not by accounts.
- **Cheap by design.** Public pages and APIs are cached, so most reads never touch the database.

---

## Part 1: Open-sourcing the code

### 1.1 Repo hygiene (before going public)
| Task | Why |
|---|---|
| Owner reviews `web/.env.example` (agents can't open `.env*` files) | Make sure it holds only placeholders |
| Scan the full git history for secrets (gitleaks or trufflehog in CI), not just the working tree | Today it's one commit and a local scan found nothing; keep it that way |
| Remove deployment-specific things: `orphic.adarshji.com`, personal names in docs and test data, the `.claude/` folder (or keep only `worker-settings.json`) | Others shouldn't inherit our setup |
| Keep LICENSE (MIT), TRADEMARK.md, SECURITY.md, CONTRIBUTING.md and CODE_OF_CONDUCT.md up to date | Already present |
| Add a "Responsible use" section to the README (below) | Instagram terms, creators' rights |
| CI on every PR: typecheck, lint, build, quality-gate unit tests, offline bot test | Contributors can't break the worker contract |
| Tag releases (v0.1.0 …) with a CHANGELOG; never edit applied migrations (already a rule) | Self-hosters upgrade safely |

### 1.2 Make self-hosting easy
- **One-click deploy:** a "Deploy to Vercel" button that adds Neon from the Marketplace and asks for the Telegram token, then `pnpm orphic setup` prints the owner invite.
- **A setup check:** `pnpm orphic doctor` checks the env vars, database, migrations, the Telegram webhook, Cloudinary (optional) and the worker key, then says in plain words what's missing.
- **Worker requirements stated clearly:** a Mac (PDFKit, textutil and Swift are built in), yt-dlp, ffmpeg, whisper-cli, and **the self-hoster's own Claude Code subscription**. Say up front that each team pays for its own AI usage.
- **Optional later: Linux worker.** Swap in poppler's `pdftotext` and `pdftoppm` for PDFKit and LibreOffice headless for textutil, with no QR codes. Only if contributors ask (the no-heavy-dependencies rule still applies).
- **Cheaper worker mode, documented:** the "subagents on a smaller model" pattern we used today, as an optional setting.
- **Free tiers, stated honestly:**
  - **Vercel:** Hobby is non-commercial personal use only, so a company team should use Pro.
  - **Neon:** the free tier is about 0.5 GB.
  - **Cloudinary:** its free plan caps PDFs and images at 10 MB and videos at 100 MB, which Orphic now works around.

### 1.3 Responsible-use text (README)
- Orphic is for personal and team knowledge: saving links to tools you've seen. It isn't a scraper or a content re-publisher.
- It downloads only what a member deliberately shares, one item at a time. It never logs in to Instagram, comments, DMs or crawls.
- Instagram's and Meta's terms restrict automated collection. Each deployment is responsible for its own use, so read the terms and get legal advice before any commercial use.
- Creators' content stays private to the team that saved it. Respect takedown requests.

### 1.4 Community
GitHub Issues and Discussions, issue templates (already in `.github/`), "good first issue" labels, and a public roadmap. Security reports go privately via SECURITY.md.

---

## Part 2: The public catalogue

### 2.1 What's public
**Item fields:**
- name, kind, category, tags, pricing;
- official link (verified only), our summary, use cases;
- the date first saved, save count and rating score (numbers only);
- related items ("From the same post").

**Source credit:** the reel or post permalink and the creator's handle, linking out to them. Nothing hosted.

**Never public:**
- captions, transcripts and comments;
- archived page text, saved copies (PDFs, Notion copies, Drive files);
- teammates' names, notes and individual ratings;
- to-dos and DM links, raw job data.

### 2.2 Which items are eligible (automatic, then reviewable)
An item is eligible only if all of these hold:
- the link is `verified` and points to a public, official page (not a DM-only resource or a private Drive link);
- it isn't a creator's own gated resource (`is_creator_owned` with no public link, `pending_dm`, `saved`-only, or a paid or gated page);
- it passed the quality gate and has no open problems;
- an admin hasn't hidden it.

New column: `entities.visibility` (`auto` | `public` | `hidden`), managed from the item page and from `pnpm orphic hide <slug>`. Our existing items get reviewed once before launch.

### 2.3 Where it lives
- A public route group on the same app, at `/explore` and `/t/<slug>`, or a separate subdomain like `tools.<domain>`. Rendered statically or cached, revalidated when items change (Next 16 cache components and `cacheTag`, or ISR).
- Private routes (`/api/snapshots`, the team app, the worker API) are untouched and keep requiring sign-in or keys.
- Public pages get proper SEO: titles, descriptions, sitemap.xml and Open Graph images.

### 2.4 Takedown and corrections
- Every public item has a "Report / request removal" link (a form with a captcha, or an email address), which hides the item at once until reviewed.
- Creators can ask for their credit to be removed or corrected.
- The response target is published in the README.

---

## Part 3: Safe, easy, efficient access for any AI

### 3.1 Public (no sign-in)
| Surface | What |
|---|---|
| `/llms.txt` | A short map, under 5 KB: what this is, how to search, links to the API and MCP. It's an informal community format, cheap to add. |
| `/llms-full.txt` or `/catalogue.json` | A bulk export of every public item, regenerated when items change, so crawlers download once instead of hammering search |
| `GET /api/public/search?q=…&category=…&page=…` | Compact JSON: name, link, one-line summary, tags, slug, plus `total` and paging. Search stays complete: results are paginated, never silently truncated (existing rule). |
| `GET /api/public/items/<slug>` | Full public fields of one item |
| `/api/public/mcp` | A read-only MCP server with 3–4 tools: `search_tools`, `get_tool`, `list_categories`, `browse_category`. No write tools. No sign-in. |
| OpenAPI spec | `/api/public/openapi.json`, so any agent framework can generate a client |
| Listing | Publish the public MCP server in the official MCP Registry and the main directories, once stable |

### 3.2 No authentication anywhere for reading
- The open MCP server is added as a connector with **just its URL**: no OAuth, no key. Claude Code: `claude mcp add --transport http orphic https://<domain>/api/public/mcp`. Claude.ai, ChatGPT, Cursor and VS Code use the same URL.
- The open REST API, `llms.txt` and the bulk export need no headers at all, so any script, agent or curl works.
- The current team API (`/api/mcp`, `/api/v1` behind keys) stays only for the owner's own team tools (saving, rating). Nothing a public user needs is behind it. **No OAuth work is planned.**
- Copy-paste "Use Orphic in your AI" snippets on the homepage, one line each per client. This is a big part of spreading: people share snippets.

### 3.3 Safety for AI clients
- The public catalogue contains **only text we wrote** (quality-gated summaries), plus facts and links. No stranger-written captions or transcripts means no prompt-injection carrier in public responses.
- The team API marks stranger-written fields (caption, transcript, page text) as untrusted in a separate field, and returns them only on request.
- Responses never include saved-copy URLs on public routes.
- Outbound links are only the verified official links.

### 3.4 Abuse and cost control (important: there's no login, so this is the only protection)
With zero authentication, abuse control does all the work. It's layered so one failure doesn't expose private data or run up a bill.

**Layer 1: the data can't leak, even with a bug**
- Public routes read through a **separate Postgres role** that can only `SELECT` from a `public_items` view (whitelisted columns, eligible rows only). It has no access to captures, transcripts, saved copies, members, keys or jobs, so a bug or injection in a public route *can't* reach private data.
- The view exposes only text we wrote, facts and links (see 2.1).

**Layer 2: most traffic never reaches the app**
- Website pages, item pages, `llms.txt` and the bulk export are static or cached at the CDN and refreshed when items change. A viral spike mostly hits the cache, which is cheap and fast.
- The bulk export (`catalogue.json`) is the advertised way to "get everything", so scrapers don't page through search.
- `ETag` and `Cache-Control` headers on the API make repeat calls nearly free.

**Layer 3: edge limits (Vercel Firewall)**
- Rate-limit rules per IP on `/api/public/*` and the open MCP (e.g. 60 requests/minute, with bursts allowed), plus a lower limit on search. Hobby allows 3 custom rules. Denied, challenged and rate-limited traffic isn't billed for CDN or data transfer.
- Attack Challenge Mode can be switched on during an attack; Vercel's DDoS protection is always on.
- Block abusive IPs and user agents with firewall rules (free).
- Vercel BotID or a captcha on any form (report/takedown, and submissions if Part 4 B is chosen).

**Layer 4: the app refuses expensive requests**
- Query length cap (200 chars), page size cap (50), max page depth, and a database `statement_timeout` (2 s) for the public role.
- MCP: only read tools, response size caps, and no tool that fetches URLs or runs code.
- No public endpoint triggers paid work: no AI calls, no worker jobs, no embeddings on request (embeddings are computed once, at save time).

**Layer 5: budget guards and kill switches**
- Vercel spend management (on Pro) with alerts and an automatic pause at a cap we choose; Neon's usage alerts.
- Separate switches: `PUBLIC_SITE`, `PUBLIC_API`, `PUBLIC_MCP`, `PUBLIC_SUBMIT` (each `on`/`off`), so one surface can be turned off without taking the rest down.
- A status note on the homepage when something is paused.

**Layer 6: watch it**
- Alerts on request spikes, error rates and database load (Vercel Observability; PostHog later, see Part 5).
- A weekly look at top IPs, user agents and queries during the first month after launch.

**Layer 7: content abuse**
- "Report this item" on every page (captcha-protected), which hides it pending review. Repeat reporters get rate-limited.
- Search queries are never shown publicly (no "trending searches" built from raw input), so spam can't be injected onto the site.

### 3.5 Data licence
- Code: MIT (unchanged).
- Catalogue text (our summaries, use cases, tags): **CC BY 4.0**, so anyone, including AIs, may reuse it with credit. Links and names are facts.
- Creators' content isn't covered: it's never published.

---

## Phases

| Phase | Contents | Rough size |
|---|---|---|
| **0. Decide** | Confirm scope (this doc), the domain for the catalogue, the data licence, and the takedown contact | Owner decisions |
| **1. Public repo** | Repo hygiene, history secret scan, README responsible use, CI, deploy button, `orphic doctor`, v0.1.0 tag | 1–2 days |
| **2. Catalogue data** | `visibility` column + migration, eligibility rules, admin hide/show, one-time review of existing items | 1 day |
| **3. Catalogue web** | `/explore` + item pages, cached, SEO, takedown form | 2–3 days |
| **4. Public AI access** | `llms.txt`, bulk export, public search/items API, read-only public MCP, OpenAPI, WAF rules | 2 days |
| **5. Landing page** | The landing page in Part 5: design pass, motion, live search, "use it in your AI" one-liners | 3–5 days |
| **6. Spread** | Share cards for each tool (Open Graph images), "found via Orphic" links, MCP Registry and directory listings, Product Hunt / Hacker News / GitHub trending push | 1–2 days + ongoing |
| **7. Analytics** | PostHog (Part 5.4) | ½ day, later |
| **8. Open submissions (optional)** | See Part 4 | Decide later |

---

## Part 4: Open submissions (decide separately)

"Completely open" could also mean **anyone can submit a reel or link**, not just read. That's possible with zero sign-in, but every submission costs real money and Mac time (download, transcribe, an AI identifying it). Options:

| Option | How | Trade-off |
|---|---|---|
| **A. Team-only capture (recommended for launch)** | Only our Telegram bot members submit; everyone reads | No new cost or abuse; the catalogue grows at our pace |
| **B. Anonymous "suggest a tool" form** | Anyone pastes a link, no sign-in. Captcha, per-IP daily limit, a global daily cap (e.g. 50/day); duplicates merge free | Costs scale with the cap we choose; spam goes through the same quality gate; the queue may back up |
| **C. Bring-your-own-AI submissions** | The public MCP gets a `suggest_tool` tool: the *caller's* AI fills in name, link and summary from what it knows, and we only verify the link (cheap, no worker) | Nearly free and very shareable, but lower quality; needs link verification and a review queue |

Recommendation: launch with **A**, then add **C** (cheap, viral-friendly). Add **B** only with a donation or sponsor to cover worker costs.

---

## Part 5: The landing page ("crazy looking")

The landing page is the thing people share, so it has to look unlike every other AI directory *and* be useful in the first 3 seconds.

### 5.1 What it does (top to bottom)
1. **Hero: the transformation, animated.** A stream of reel-shaped cards (phone frames, blurred thumbnails, "comment SKILL for the link") flies in and *resolves* into clean tool cards with a verified link. That's what Orphic does, shown without words. Tagline idea: "Every AI tool from every reel. Found, verified, free."
2. **A live search box right in the hero.** Type and see real results instantly (from the cached public API). No sign-in, no "join the waitlist". This is the hook.
3. **Live numbers:** tools found, reels decoded, "comment-for-link" reels we didn't have to comment on. Real counts from the catalogue.
4. **Browse by vibe:** big category tiles (AI video, Claude skills, prompts, design…) with hover previews.
5. **"Use it in your AI":** tabs for Claude Code, Claude.ai, ChatGPT, Cursor and VS Code, each a one-line snippet with a copy button. No keys, no sign-up.
6. **Open source block:** a GitHub star button with a live count, a "Deploy your own" button, and the MIT badge.
7. **Footer:** responsible use, takedown link, data licence (CC BY 4.0).

### 5.2 Look and feel
- A bold, distinctive visual identity built on the Orphic lyre and the Orpheus myth (music, sound waves, "bringing things back from the underworld" of DMs and link-in-bio). Dark or high-contrast, with one signature colour.
- Motion that means something: reels → tools, sound-wave lines, cards that tilt toward the cursor, scroll-driven reveals. Use CSS and the View Transitions API first and a small animation library only if needed (keep it light per the no-heavy-deps rule). Respect `prefers-reduced-motion`.
- Fast: static and cached, with the hero visible in under a second on mobile and a good Lighthouse score. A pretty page that loads slowly kills sharing.
- Every tool page gets an **auto-generated share image** (Open Graph) in the same style, so links shared on X, LinkedIn and WhatsApp look striking. This is a big viral lever.
- Build it with the frontend-design / design skills and Next 16 (cache components). Explore 2–3 directions as quick mockups before building.

### 5.3 Viral loops to design in
- Share buttons on every tool ("found this via Orphic").
- "Can't find a tool? Paste the reel" (only if Part 4 B or C is chosen).
- Embeddable "tool card" widget for blogs.
- The GitHub README shows the live site and the one-line AI setup at the top.

### 5.4 Analytics: PostHog (later)
- Add PostHog after launch to see what spreads: search terms (aggregated), zero-result searches (which tools to find next), snippet copies per AI client, share clicks, GitHub/deploy clicks, bulk-export downloads.
- Privacy-friendly setup: cookieless or memory-only mode, no personal data, IPs not stored, DNT respected. That avoids a cookie banner and keeps the "open and free" spirit.
- MCP and API usage tracked server-side as counts only (no request content).
- Keep it optional for self-hosters: off unless `POSTHOG_KEY` is set.

## Open questions for the owner
1. Catalogue domain: a path on `orphic.adarshji.com`, or a short shareable domain (better for spreading)? (The name "Orphic" is under our trademark policy, so the official catalogue can use it.)
2. Should the catalogue show only our team's finds, or later accept other self-hosted teams' public items (federation)? Recommendation: ours only for v1.
3. A takedown contact email we're happy to publish.
4. Vercel plan: a free, non-commercial open-source catalogue should fit Hobby's "non-commercial" rule. If it goes viral, Hobby's monthly limits can pause the site for the rest of the month, so budget for Pro ($20/month) once traffic grows. Caching keeps this low.
6. Open submissions: A, B or C from Part 4?
7. Landing page: any references or sites whose look you love? Dark or light? A signature colour?
8. PostHog: cloud (EU or US) or self-hosted, when we add it?
5. A lawyer's look at Part 1.3 and 2.1 before launch (Instagram terms, creator credit, the data licence). Recommended, not required for code-only open source.

## Research notes (1 Nov 2026)
- **MCP authorization:**
  - The 2026-07-28 spec revision prefers Client ID Metadata Documents over Dynamic Client Registration, which is deprecated and kept for compatibility. The MCP server is an OAuth 2.1 resource server.
  - Claude's exact connector requirements weren't confirmed from Anthropic's docs. (No longer needed: the open MCP has no auth.)
- **Instagram:**
  - Instagram's and Meta's terms bar automated collection without permission. Logged-in automation risks direct contract enforcement, and collected profile/comment data is personal data (GDPR/CCPA).
  - Orphic's per-share, logged-out, user-initiated downloads and never re-publishing content keep risk low. A legal review is still advised for anything public or commercial.
- **Vercel Hobby:** non-commercial personal use only. Pro is $20 per user per month.
- **Neon free tier:** about 0.5 GB storage, scales to zero (third-party source; check Neon's pricing).
- **Vercel WAF:**
  - Hobby allows 3 custom rules, including rate limiting.
  - Rate-limit rules are metered (about $0.50 per 1M allowed requests).
  - Traffic denied, challenged or rate-limited isn't billed for CDN or data transfer (May 2026 change).
- **llms.txt:** about 9% of the top 1,000 sites, community-managed, not a formal standard. It's cheap, so worth adding, with a short `llms.txt` plus a separate full dump.
