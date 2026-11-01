# Contributing to Orphic

Thanks for helping! Orphic is a small, focused project: a self-hosted team library of AI tools found in reels.

## Ground rules
- **Open an issue first** for anything bigger than a small fix, so we can agree on the approach.
- **Keep it light:** no heavy dependencies, no new hosted services as requirements. Self-hosting must stay simple.
- **Read [AGENTS.md](AGENTS.md).** It has the repository map, commands and rules; they apply to humans too.

## Local setup
Follow [docs/self-hosting.md](docs/self-hosting.md), sections 1–2. You need Node 24, pnpm, Docker and a test Telegram bot from @BotFather.

## Before you open a PR
```bash
cd web
npx tsc --noEmit
pnpm lint
pnpm build
```
- Schema changes go in a new file in `db/migrations/`.
- Contract changes go in `web/src/lib/contracts.ts`, followed by `pnpm contracts`.
- Update the docs if behaviour changes.

## Sign your commits (DCO)
By contributing you certify the [Developer Certificate of Origin](https://developercertificate.org/): you wrote the code, or have the right to submit it under the project's license. Add a sign-off line to every commit:
```bash
git commit -s -m "Fix search pagination"
```
This adds `Signed-off-by: Your Name <you@example.com>`.

## Code of conduct
Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
