"use client";
// Hero: the whole product in one loop. A reel plays (captions, "comment X for the link"), a scan line reads it,
// the evidence it finds flies out as data, and it resolves into a verified tool card. Cycles through real tools.
import { useEffect, useRef, useState } from "react";
import type { LandingData, LandingItem } from "@/lib/landing";
import { MagneticButton, ScrollCue } from "./buttons";
import "./hero.css";

// Phases of one example: 0 hidden · 1 reel playing · 2 keyword · 3 scanning · 4 evidence · 5 resolved · 6 exiting
const TIMELINE = [0, 250, 1700, 2900, 3500, 4700, 8600];
const LOOP = 9200;

function repoLabel(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname === "github.com") return u.pathname.split("/").filter(Boolean).slice(0, 2).join(" / ");
    return u.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Use cases are either actions ("make motion graphics…") or things ("paper cutout collage b-roll…").
const VERBS = /^(make|build|create|turn|find|get|write|run|test|add|generate|give|use|plan|track|search|automate|clone|record|edit|design|copy|learn|see|send|let|stop|save|map|audit|check|ship|launch|grow|sell|book|reply|research|scrape|monitor|control|predict|forecast|dub|clone|cut|remove|repurpose|translate|summarize|analyse|analyze|organize|connect|deploy|host|host|draw|animate|render|recreate|rebuild|reverse|understand|pick|browse)\b/i;

function captionFor(item: LandingItem) {
  const what = item.kind === "repo" ? "this free repo" : item.kind === "prompt" ? "these free prompts" : "this free tool";
  let use = (item.useCases[0] ?? item.summary).replace(/\.$/, "");
  if (use.length > 54) use = use.slice(0, 52).replace(/\s+\S*$/, "") + "…";
  const lead = VERBS.test(use) ? (item.kind === "prompt" ? `${what} let you` : `${what} lets you`) : `${what} for`;
  return { lead, use };
}

// Generic outline icons for the reel's side rail (like, comment, share, save). No platform branding.
const RAIL = [
  "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  "M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z",
  "M21 4L10 14M21 4l-6.5 16-3.5-7-7-3.5z",
  "M6 4h12v16l-6-4-6 4z",
];

/** A word of the title, rising out of its own mask. */
function Word({ i, links, children }: { i: number; links?: boolean; children: string }) {
  return (
    <span className="ht-mask">
      <span className={links ? "ht-w ht-links" : "ht-w"} style={{ ["--w" as string]: i }}>
        {links ? [...children].map((ch, n) => (
          <span key={n} className="ht-l" style={{ ["--c" as string]: n }}>
            {ch}
          </span>
        )) : children}
        {links && <span className="ht-string" />}
      </span>
    </span>
  );
}

export function Hero({ examples, stats }: { examples: LandingItem[]; stats: LandingData["stats"] }) {
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState(0);
  const [reduced, setReduced] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!examples.length || reduced) return;
    timers.current.forEach(clearTimeout);
    timers.current = TIMELINE.map((t, p) => window.setTimeout(() => setPhase(p), t));
    timers.current.push(window.setTimeout(() => setI((n) => (n + 1) % examples.length), LOOP));
    return () => timers.current.forEach(clearTimeout);
  }, [i, reduced, examples.length]);

  // Reduced motion: no loop, just the finished state.
  const shown = reduced ? 5 : phase;
  const item = examples[i];
  const cap = item ? captionFor(item) : null;
  const keyword = item?.keyword ?? "LINK";

  return (
    <section className="hero relative pt-24 sm:pt-[104px]" aria-labelledby="hero-title">
      <div className="hero-strings" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, n) => (
          <span key={n} style={{ left: `${8 + n * 17}%`, ["--n" as string]: n }} data-pluck={shown === 3 ? "true" : "false"} />
        ))}
      </div>

      <div className="lp-wrap relative grid items-center gap-14 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="lp-label hero-in flex items-center gap-2.5" style={{ ["--t" as string]: "0ms" }}>
            <span className="hero-dot" aria-hidden="true" /> Free · open source · no login
          </p>
          {/* Each word rises out of its own mask; "links" lands last and its string is plucked. */}
          <h1 id="hero-title" className="lp-display hero-title mt-5 text-[clamp(54px,9.2vw,124px)]" aria-label="Reels in. Real links out.">
            <span className="ht-line" aria-hidden="true">
              <Word i={0}>Reels</Word> <Word i={1}>in.</Word>
            </span>
            <span className="ht-line" aria-hidden="true">
              {/* "Real links" never splits across lines */}
              <span className="ht-keep">
                <Word i={2}>Real</Word>{" "}
                <Word i={4} links>
                  links
                </Word>
              </span>{" "}
              <Word i={3}>out.</Word>
            </span>
          </h1>
          <p className="hero-in mt-8 max-w-[34rem] text-[18px] leading-[1.6] text-[var(--ash)] sm:text-[19px]" style={{ ["--t" as string]: "420ms" }}>
            Share an Instagram reel. Orphic watches it, reads every frame, finds the AI tool behind it and checks the official link, even when the creator
            says &ldquo;comment SKILL&rdquo;. Free, open source, and searchable by anyone, or any AI.
          </p>
          <div className="hero-in mt-10 flex flex-wrap items-center gap-x-7 gap-y-4" style={{ ["--t" as string]: "520ms" }}>
            <MagneticButton href="/explore" label={`Search ${stats.tools} tools`} icon="search" />
            <ScrollCue target="how" label="See how it works" />
          </div>
          {stats.reels > 0 && (
            <dl className="lp-mono hero-in mt-14 flex flex-wrap gap-x-8 gap-y-3 text-[12.5px] text-[var(--dust)]" style={{ ["--t" as string]: "620ms" }}>
              <div>
                <dt className="sr-only">Tools</dt>
                <dd>
                  <span className="text-[var(--bone)]">{stats.tools}</span> tools verified
                </dd>
              </div>
              <div>
                <dt className="sr-only">Reels</dt>
                <dd>
                  <span className="text-[var(--bone)]">{stats.reels}</span> reels decoded
                </dd>
              </div>
              {stats.commentReels > 0 && (
                <div>
                  <dt className="sr-only">Comment-gated reels solved</dt>
                  <dd>
                    <span className="text-[var(--bone)]">{stats.commentSolved}</span> &ldquo;comment for the link&rdquo; reels solved
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>

        {item && cap && (
          <div className="hero-stage lg:col-span-5" data-phase={shown} aria-hidden="true">
            <div className="hero-glow" />
            {/* The reel */}
            <div className="hero-phone" key={`p${i}`}>
              {/* The "video": a creator in front of a screen recording of the tool, like most AI-tool reels */}
              <div className="hero-video">
                <span className="hv-light" />
                <div className="hv-screen">
                  <div className="hv-bar">
                    <i />
                    <i />
                    <i />
                    <span className="hv-url">{item.domain ?? repoLabel(item.url)}</span>
                  </div>
                  <div className="hv-body">
                    <p className="hv-repo">{repoLabel(item.url)}</p>
                    <span className="hv-ln" style={{ width: "82%" }} />
                    <span className="hv-ln" style={{ width: "64%" }} />
                    <div className="hv-chart">
                      {[38, 52, 46, 70, 62, 84, 78, 96].map((h, n) => (
                        <span key={n} style={{ height: `${h}%`, ["--n" as string]: n }} />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="hv-person">
                  <span className="hv-head" />
                  <span className="hv-body-s" />
                </span>
                <span className="hero-grain" />
                <span className="hv-vignette" />
              </div>
              <div className="hero-progress">
                <span />
                <span />
                <span />
              </div>
              <div className="hero-captions">
                <span className="hc hc1">{cap.lead}</span>
                <span className="hc hc2">{cap.use}</span>
                <span className="hc hc3">
                  comment <b>{keyword}</b> for the link
                </span>
              </div>
              <ul className="hero-rail">
                {RAIL.map((d, n) => (
                  <li key={n}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d={d} />
                    </svg>
                  </li>
                ))}
              </ul>
              <div className="hero-meta">
                <p className="hero-who">
                  <span className="hero-avatar" />
                  <span className="lp-mono">@{item.creator ?? "creator"}</span>
                </p>
                <p className="hero-desc">
                  Comment &ldquo;{keyword}&rdquo; and I&rsquo;ll DM you the link
                </p>
              </div>
              <div className="hero-scan" />
            </div>

            {/* What Orphic reads */}
            <ul className="hero-evidence lp-mono" key={`e${i}`}>
              <li style={{ ["--d" as string]: "0ms" }}>
                <em>caption</em> &ldquo;comment {keyword}&rdquo;
              </li>
              <li style={{ ["--d" as string]: "380ms" }}>
                <em>frame 0:06</em> {repoLabel(item.url)}
              </li>
              <li style={{ ["--d" as string]: "760ms" }}>
                <em>transcript</em> &ldquo;{cap.use.split(" ").slice(0, 4).join(" ")}…&rdquo;
              </li>
            </ul>

            {/* The answer */}
            <div className="hero-card" key={`c${i}`}>
              <p className="lp-label flex items-center gap-2 !text-[var(--pom)]">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 8.5l3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Found · link verified
              </p>
              <p className="mt-3 text-[21px] font-medium leading-tight text-[var(--bone)]">{item.name}</p>
              <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-[var(--ash)]">{item.summary}</p>
              <div className="lp-mono mt-4 flex items-center justify-between gap-3 border-t border-[var(--hair)] pt-3 text-[12px]">
                <span className="truncate text-[var(--dust)]">{item.domain ?? repoLabel(item.url)}</span>
                <span className="shrink-0 text-[var(--pom)]">no need to comment</span>
              </div>
            </div>

            <div className="hero-dots">
              {examples.map((_, n) => (
                <span key={n} data-on={n === i ? "true" : "false"} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
