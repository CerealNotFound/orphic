import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui";
import { WaitlistForm } from "./waitlist-form";

export const metadata: Metadata = {
  title: "Orphic: never lose a tool you saw in a reel",
  description:
    "A shared memory for the AI tools, prompts and workflows your team spots on Instagram. Share a reel; Orphic finds the real link, saves it, and answers when you ask. Open source, coming soon.",
  openGraph: {
    title: "Orphic: never lose a tool you saw in a reel",
    description: "Share a reel. Orphic finds the real link, saves it for your team, and answers when you ask. Open source, coming soon.",
    type: "website",
  },
};

const STEPS = [
  { n: "1", title: "Share the reel", body: "Instagram → Share → Orphic. Links, docs and screenshots work too. Two taps, no typing." },
  { n: "2", title: "Orphic does the digging", body: "It watches the reel, reads the text on screen, finds the actual tool and checks its official link, even when the reel says “comment X to get it”." },
  { n: "3", title: "Ask, anytime", body: "“What was that tool for turning podcasts into clips?” Ask in chat, on the web, or from your own AI assistant. You get the tool, the link and who saved it." },
];

const FEATURES = [
  { icon: "🔗", title: "Real links, verified", body: "Official sites and repos, not affiliate or link-in-bio pages." },
  { icon: "🔒", title: "Copies that don't vanish", body: "Docs, PDFs and file packs are saved privately, so a deleted link doesn't mean a lost resource." },
  { icon: "👥", title: "Built for teams", body: "Duplicates merge, teammates rate what actually works, and a weekly digest shows what everyone found." },
  { icon: "🔎", title: "Search that doesn't forget", body: "Ask in your own words, typos included. List questions return everything, not just the top three." },
  { icon: "🤖", title: "Agent-ready", body: "A full Markdown export, an MCP server and an API, so Claude and other agents can use your library directly." },
  { icon: "🧩", title: "Open source", body: "Self-host it for your team, keep your data in your own database. MIT licensed." },
];

export default function Welcome() {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Logo className="text-lg" />
        <Link href="/signin" className="rounded-lg px-3 py-1.5 text-sm font-medium text-subtle transition hover:bg-sunken hover:text-ink">
          Team sign in →
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-3xl px-5 pb-16 pt-10 text-center sm:px-8 sm:pt-16">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-subtle">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" /> Coming soon · open source
          </p>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-6xl">
            Never lose a tool you saw in a reel.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-subtle">
            Orphic is your team&apos;s memory for the AI tools, prompts and workflows you spot on Instagram. Share a reel and Orphic finds the real link,
            saves it, and answers when you ask.
          </p>
          <div className="mx-auto mt-8 max-w-md">
            <WaitlistForm />
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="how" className="border-y border-line bg-card/50">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
            <h2 id="how" className="text-center text-sm font-semibold uppercase tracking-wider text-subtle">How it works</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="rounded-2xl border border-line bg-card p-6">
                  <span className="inline-flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-strong">{s.n}</span>
                  <h3 className="mt-4 text-base font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-subtle">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="why" className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
          <h2 id="why" className="text-center text-sm font-semibold uppercase tracking-wider text-subtle">Why Orphic</h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-2xl border border-line bg-card p-6">
                <span className="text-2xl" aria-hidden="true">{f.icon}</span>
                <h3 className="mt-3 text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-subtle">{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Example */}
        <section aria-labelledby="ask" className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
          <h2 id="ask" className="sr-only">Example</h2>
          <div className="rounded-2xl border border-line bg-card p-5 text-sm shadow-sm sm:p-6">
            <p className="text-subtle">You</p>
            <p className="mt-1 text-ink">what was that free tool for turning podcasts into short clips?</p>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-subtle">Orphic</p>
              <p className="mt-1 text-ink">
                ✅ <b>ClipTool</b>: finds the best moments in a long video and cuts them into captioned vertical clips. Free plan available.
              </p>
              <p className="mt-1 font-mono text-xs text-subtle">cliptool.example · saved by 3 teammates · 👍 2</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 py-6 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>Orphic · open source, coming soon</span>
          <Link href="/signin" className="hover:text-ink">Already on a team? Sign in</Link>
        </div>
      </footer>
    </div>
  );
}
