// Open source + footer. Server component (the form inside is a client island).
import Link from "next/link";
import { Lyre } from "./lyre";
import { MakerCard, Spotlight } from "./maker-card";
import { NotifyForm } from "./notify-form";
import { RevealScope, Words } from "./reveal";
import "./open-source.css";
import { SITE } from "../site";

const STACK = [
  ["web", "Next.js 16 · React 19"],
  ["data", "Postgres · full-text + fuzzy + vectors"],
  ["capture", "Telegram bot"],
  ["worker", "yt-dlp · ffmpeg · whisper.cpp · Claude Code"],
  ["for AIs", "MCP · REST · llms.txt"],
] as const;

const FACTS = [
  { k: "Code", v: "MIT licence. Fork it, run it, change it." },
  { k: "Catalogue", v: "Our summaries are CC BY 4.0. Links are facts." },
  { k: "Access", v: "Nothing behind a login. No keys, no accounts." },
  { k: "Creators", v: "Every find credits the post it came from. Saved copies link back to the original." },
];

export function OpenSource() {
  const { repo, maker } = SITE;
  return (
    <RevealScope as="section" id="open-source" className="relative border-t border-[var(--hair)] pb-24 pt-28 sm:pt-36">
      <div className="lp-wrap grid gap-16 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="lp-label" data-rv="rise">Open source</p>
          <h2 className="lp-display mt-6 text-[clamp(44px,6vw,84px)]" data-rv="words" aria-label="Free. Open. Yours to run.">
            <span aria-hidden="true">
              <Words text="Free. Open." />
              <br />
              <Words text="Yours to run." start={2} />
            </span>
          </h2>
          <p className="mt-7 max-w-[32rem] text-[18px] leading-[1.6] text-[var(--ash)]" data-rv="rise" style={{ ["--rv-d" as string]: "240ms" }}>
            Every line of Orphic is public. Use the open catalogue, or run your own copy for your team: your bot, your database, your data.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-4" data-rv="rise" style={{ ["--rv-d" as string]: "340ms" }}>
            <a href={repo.url} target="_blank" rel="noopener noreferrer" className="lp-btn">
              <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              View the repo on GitHub
            </a>
            <span className="lp-mono os-clone text-[13px] text-[var(--dust)]" style={{ ["--n" as string]: `git clone ${repo.url.replace("https://", "")}`.length }}>
              <span className="os-clone-text">git clone {repo.url.replace("https://", "")}</span>
              <span className="os-caret" aria-hidden="true" />
            </span>
          </div>
        </div>

        <div className="lg:col-span-6 lg:pt-4">
          <a
            href={repo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="os-card lp-mono block overflow-hidden rounded-[16px] border border-[var(--hair)] bg-[var(--ink-1)] text-[13px] transition-[border-color] duration-200 hover:border-[var(--hair-2)]"
            data-rv="term"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--hair)] px-5 py-4">
              <span className="text-[14px] text-[var(--bone)]">
                {repo.owner} <span className="text-[var(--dust)]">/</span> <b className="font-semibold">{repo.name}</b>
              </span>
              <span className="rounded-full border border-[var(--hair-2)] px-2.5 py-0.5 text-[11px] text-[var(--ash)]">Public · MIT</span>
            </div>
            <p className="px-5 pt-4 font-sans text-[14px] leading-relaxed text-[var(--ash)]">
              Turns the reels you share into a searchable catalogue of AI tools with verified links. Telegram bot, web app, open API and MCP server.
            </p>
            <dl className="mt-4 divide-y divide-[var(--hair)] border-t border-[var(--hair)]">
              {STACK.map(([k, v], i) => (
                <div key={k} className="os-line grid grid-cols-[88px_1fr] gap-3 px-5 py-3" style={{ ["--rv-i" as string]: i }}>
                  <dt className="text-[var(--pom)]">{k}</dt>
                  <dd className="text-[var(--bone)]">{v}</dd>
                </div>
              ))}
            </dl>
          </a>
          <dl className="mt-8 grid gap-5 sm:grid-cols-2" data-rv="stagger">
            {FACTS.map((f) => (
              <div key={f.k}>
                <dt className="lp-label">{f.k}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-[var(--ash)]">{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Two separate cards: who's behind it, and the mailing list */}
      <div className="lp-wrap mt-24 grid gap-5 lg:grid-cols-12" data-rv="stagger">
        <div className="lg:col-span-5 [&>*]:h-full">
          <MakerCard name={maker.name} contact={maker.contact} />
        </div>
        <Spotlight className="p-7 sm:p-9 lg:col-span-7">
          <p className="lp-label">Mailing list</p>
          <p className="mt-5 max-w-[34rem] text-[20px] leading-snug text-[var(--bone)] sm:text-[22px]">
            A small, no-spam mailing list: the playbooks, workflows and AI tools I actually use. I only send when there&apos;s something worth your time.
          </p>
          <div className="mt-8">
            <NotifyForm />
          </div>
        </Spotlight>
      </div>
    </RevealScope>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--hair)]">
      <div className="lp-wrap grid gap-10 py-14 sm:grid-cols-12">
        <div className="sm:col-span-7">
          <div className="group flex items-center gap-3">
            <Lyre size={30} className="text-[var(--pom)]" />
            <span className="lp-display text-[30px] leading-none">orphic</span>
          </div>
          <p className="mt-5 max-w-[28rem] text-[14px] leading-relaxed text-[var(--ash)]">
            Orpheus went into the underworld to bring back what was lost. Orphic goes into reels, DMs and link-in-bio pages and brings back the real link.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-[14px] sm:col-span-5">
          <ul className="space-y-3 text-[var(--ash)]">
            <li>
              <Link href="/#how" className="hover:text-[var(--bone)]">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/explore" className="hover:text-[var(--bone)]">
                Catalogue
              </Link>
            </li>
            <li>
              <Link href="/#ai" className="hover:text-[var(--bone)]">
                For AIs
              </Link>
            </li>
          </ul>
          <ul className="space-y-3 text-[var(--ash)]">
            <li>
              <Link href="/#open-source" className="hover:text-[var(--bone)]">
                Open source
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="lp-wrap lp-mono flex flex-wrap justify-between gap-3 border-t border-[var(--hair)] py-6 text-[11.5px] text-[var(--dust)]">
        <span>© 2026 Orphic contributors · MIT · made by {SITE.maker.name}</span>
        <span>Every find credits its creator.</span>
      </div>
    </footer>
  );
}
