"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { LandingItem } from "@/lib/landing";
import { RevealScope, Words } from "./reveal";
import "./how-it-works.css";

const STEPS = [
  {
    title: "Share",
    body: "Tap Share on any reel and send it to the Orphic bot on Telegram. Links, screenshots and PDFs work too.",
    chips: ["Instagram reels", "links", "screenshots", "PDFs", "2 taps"],
  },
  {
    title: "Decode",
    body: "It downloads the reel once and reads it at two frames a second: the speech, the caption, and every name that flashes on screen.",
    chips: ["2 frames / sec", "whisper.cpp transcript", "on-screen text", "comments"],
  },
  {
    title: "Verify",
    body: "Then it checks the official link: the right site, the right repo, a real page. No affiliate links, no link-in-bio detours.",
    chips: ["official site", "GitHub repo", "200 OK", "no link-in-bio"],
  },
  {
    title: "Ask",
    body: "Search it later in your own words, from the web, Telegram or any AI.",
    chips: ["web", "Telegram", "Claude", "ChatGPT", "any script"],
  },
];

function repoLabel(example: LandingItem): string {
  try {
    const u = new URL(example.url);
    if (u.hostname.replace(/^www\./, "") === "github.com") {
      const [owner, repo] = u.pathname.split("/").filter(Boolean);
      if (owner && repo) return `${owner} / ${repo}`;
    }
  } catch {}
  return example.name;
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M5.2 8.2l2 2 3.6-4" />
    </svg>
  );
}

function ShareScreen() {
  return (
    <div className="hiw-chat">
      <div className="hiw-chat-head">
        <span className="hiw-avatar lp-mono">O</span>
        <span>Orphic bot</span>
      </div>
      <div className="hiw-msg hiw-msg--out">
        <span className="hiw-linkpill lp-mono">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 013.9 3.9l-1 1M9 11.5l-1 1a2.8 2.8 0 01-3.9-3.9l1-1" />
          </svg>
          instagram.com/reel/…
        </span>
      </div>
      <div className="hiw-msg hiw-msg--in">
        <span className="hiw-dot" />
        <span>Got it (#87). Reading it now, usually under a minute.</span>
      </div>
    </div>
  );
}

function DecodeScreen({ label }: { label: string }) {
  const hit = 6;
  return (
    <div className="hiw-decode">
      <div className="hiw-sheet-wrap">
        <div className="hiw-sheet">
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className="hiw-tile"
              data-hit={i === hit}
              style={{ "--a": `${38 + ((i * 17) % 30)}%`, "--b": `${24 + ((i * 11) % 28)}%` } as CSSProperties}
            >
              {i === hit && <span className="hiw-tag lp-mono">{label}</span>}
            </div>
          ))}
          <div className="hiw-scanclip">
            <div className="hiw-scan" />
          </div>
        </div>
      </div>
      <p className="hiw-caption lp-mono">transcript · caption · 24 frames</p>
    </div>
  );
}

function VerifyScreen({ example }: { example: LandingItem }) {
  const lines: ReactNode[] = [
    <>
      <span className="hiw-k">GET</span> {example.url}
    </>,
    <>→ 200 OK</>,
    <>→ title matches “{example.name}”</>,
  ];
  return (
    <div className="hiw-term">
      <div className="hiw-term-head lp-mono">verify</div>
      <div className="hiw-term-body lp-mono">
        {lines.map((l, i) => (
          <div key={i} className="hiw-line" style={{ "--i": i } as CSSProperties}>
            {l}
          </div>
        ))}
        <div className="hiw-line" style={{ "--i": 3 } as CSSProperties}>
          <span className="hiw-verified">
            <Check /> Verified
          </span>
        </div>
        {example.keyword && (
          <div className="hiw-line hiw-line--dim" style={{ "--i": 4 } as CSSProperties}>
            → no need to comment {example.keyword}
          </div>
        )}
      </div>
    </div>
  );
}

function AskScreen({ example, active }: { example: LandingItem; active: boolean }) {
  const query = example.useCases[0] ?? example.summary.slice(0, 40);
  const [n, setN] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let iv: ReturnType<typeof setInterval> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const t0 = setTimeout(
      () => {
        if (reduce) {
          setN(query.length);
          setDone(true);
          return;
        }
        let i = 0;
        iv = setInterval(() => {
          i += 1;
          setN(i);
          if (i >= query.length) {
            clearInterval(iv);
            t2 = setTimeout(() => setDone(true), 220);
          }
        }, 35);
      },
      reduce ? 0 : 350,
    );
    return () => {
      clearTimeout(t0);
      if (iv) clearInterval(iv);
      if (t2) clearTimeout(t2);
      // Reset for the next time this screen becomes active.
      setN(0);
      setDone(false);
    };
  }, [active, query]);

  return (
    <div className="hiw-ask">
      <div className="hiw-input">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <span className="hiw-typed">
          {query.slice(0, n)}
          <span className="hiw-caret" />
        </span>
      </div>
      <div className="hiw-result" data-in={done}>
        <div className="hiw-result-top">
          <span className="hiw-result-name">{example.name}</span>
          {example.domain && <span className="hiw-result-domain lp-mono">{example.domain}</span>}
        </div>
        <p className="hiw-result-sum">{example.summary}</p>
      </div>
    </div>
  );
}

export function HowItWorks({ example }: { example: LandingItem }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const label = repoLabel(example);
  const screen = (i: number) => {
    const on = active === i;
    return i === 0 ? <ShareScreen /> : i === 1 ? <DecodeScreen label={label} /> : i === 2 ? <VerifyScreen example={example} /> : <AskScreen example={example} active={on} />;
  };

  return (
    <section className="hiw" aria-labelledby="hiw-title">
      <RevealScope className="lp-wrap">
        <p className="lp-label" data-rv="rise">How it works</p>
        <h2 id="hiw-title" className="lp-display hiw-title" data-rv="words" aria-label="From a reel to a verified link in under a minute.">
          <span aria-hidden="true">
            <Words text="From a reel to a verified link in under a minute." />
          </span>
        </h2>

        <div className="hiw-grid">
          <div className="hiw-left">
          {/* Desktop: every step stays in view, joined by a progress string; the active one opens up. */}
          <div className="hiw-rail" aria-hidden="true" data-rv="rail">
            <div className="hiw-rail-track">
              <span className="hiw-rail-fill" style={{ transform: `scaleY(${(active + 1) / STEPS.length})` }} />
            </div>
            {STEPS.map((s, i) => (
              <div key={s.title} className="hiw-rail-step" data-active={active === i} data-done={i < active} style={{ ["--rv-i" as string]: i }}>
                <span className="hiw-rail-dot" />
                <div className="hiw-rail-head">
                  <span className="hiw-rail-num lp-mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="hiw-rail-title lp-display">{s.title}</span>
                </div>
                <div className="hiw-rail-more">
                  <div>
                    <p className="hiw-rail-text">{s.body}</p>
                    <ul className="hiw-rail-chips lp-mono">
                      {s.chips.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ol className="hiw-steps">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                data-i={i}
                data-active={active === i}
                data-rv="rise"
                className="hiw-step"
              >
                <div className="hiw-step-body">
                  <span className="hiw-num lp-mono">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="hiw-step-title">{s.title}</h3>
                  <p className="hiw-step-text">{s.body}</p>
                </div>
                <div className="hiw-inline" aria-hidden="true">
                  <div className="hiw-frame" data-on={active === i}>
                    {screen(i)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          </div>

          <div className="hiw-stage" aria-hidden="true">
            <div className="hiw-panel" data-rv="screen">
              {STEPS.map((s, i) => (
                <div key={s.title} className="hiw-frame hiw-frame--stage" data-on={active === i}>
                  {screen(i)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </RevealScope>
    </section>
  );
}
