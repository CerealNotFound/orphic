# Orphic landing page: design direction (read before touching any file here)

**Idea.** Orpheus went into the underworld to bring back what was lost. Orphic goes into reels, DMs and "link in bio" and brings back the real link. Visual metaphor: **strings and decoding**: a lyre's strings, scan lines, frames turning into clean, verified facts. Dark, warm, confident, editorial. Bold but never noisy.

## Hard rules (anti AI slop)
- **No purple/indigo, no rainbow or gradient text, no glow on everything, no glassmorphism except the nav bar.**
- No emoji anywhere. No icon soup: use simple 1.5px line icons drawn inline as SVG, or text.
- No three-equal-cards rows, no centred-stack hero, no `h-screen` heroes, no fade-up on every element.
- Sentence case everywhere. No filler verbs (empower, unlock, leverage, transform, supercharge, seamless).
- Real content only: every number and tool name comes from the `LandingData` props. Never invent stats, testimonials or logos.
- Numbered markers only for real sequences (the 4 steps).
- One signature motion per section, at most. Everything else is still.

## Tokens (defined in `landing.css` on `.lp`; use these CSS vars, never raw colours)
| Var | Value | Use |
|---|---|---|
| `--void` | #0B0A08 | page background (warm black) |
| `--ink-1` | #141210 | raised surfaces |
| `--ink-2` | #1C1915 | cards, inputs |
| `--hair` | rgba(237,230,217,.09) | 1px borders and rules |
| `--hair-2` | rgba(237,230,217,.16) | stronger borders, hover |
| `--bone` | #EDE6D9 | main text |
| `--ash` | #A39A8C | secondary text (AA on void) |
| `--dust` | #6B6358 | tertiary / labels only (large or mono caps) |
| `--pom` | #FF5A36 | THE signal colour (pomegranate). Primary button, strike lines, scan line, "verified" ticks, focus |
| `--pom-ink` | #1A0802 | text on pom |
| `--pom-soft` | rgba(255,90,54,.14) | tinted backgrounds, selection |

Fonts (CSS vars): `--font-display` = Gloock (headlines ≥ 36px only, weight 400, tracking -0.02em, leading 0.95–1.05), `--font-sans` = Geist (body), `--font-mono` = Geist Mono (labels, data, code, "decoded" text; caps labels 11–12px with tracking 0.08em).

Radii: pill 999px · card 16px · input 10px · chip 6px.

Easing / timing (CSS vars): `--ease-out: cubic-bezier(0.23,1,0.32,1)` (enter), `--ease-io: cubic-bezier(0.77,0,0.175,1)` (on-screen movement), `--ease-drawer: cubic-bezier(0.32,0.72,0,1)`. Press 120ms (scale .97), hover 180ms, UI ≤ 300ms, storytelling 600–1200ms. Never `ease-in`. Animate only `transform`, `opacity`, `clip-path`, `filter`. Respect `prefers-reduced-motion` (cross-fade or static final state).

Layout: max width 1200px, side padding 20px (mobile) / 40px (desktop). Left-aligned editorial; asymmetric splits (7/5, 8/4). Vary section padding by weight (hero ~140px top, minor sections ~80px). Sections are separated by space and background shifts, not `<hr>` everywhere. Mobile first: everything must work at 375px wide.

Buttons: primary = pom background, pom-ink text, radius pill, 44px tall; secondary = text link with arrow, or 1px `--hair-2` outline. One primary per section.

## Data contract
Sections receive props typed in `src/lib/landing.ts` (`LandingData`, `LandingItem`). Items are public-safe only: name, official link, our summary, category, tags, use cases, comment keyword, creator handle. Link out to `item.url` (official) in a new tab.
