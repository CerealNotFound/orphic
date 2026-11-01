"use client";

import { useEffect, useMemo, useRef } from "react";
import type { LandingData } from "@/lib/landing";
import { RevealScope, Words } from "./reveal";
import "./comment-strike.css";

type Phrase = { id: string; lead: string; kw?: string };

const VARIANTS = ["link in bio", "DM me for the link", "check the pinned comment"];
const DURATIONS = [62, 48, 56];

function buildRows(keywords: string[]): Phrase[][] {
  const kws = keywords.slice(0, 12);
  const all: Phrase[] = [];
  const kwPhrases: Phrase[] = kws.map((k) => ({ id: `k-${k}`, lead: "comment ", kw: k.toUpperCase() }));
  const variants: Phrase[] = VARIANTS.map((v) => ({ id: `v-${v}`, lead: v }));
  // Interleave so each row gets a mix.
  let vi = 0;
  kwPhrases.forEach((p, i) => {
    all.push(p);
    if (i % 3 === 2) all.push(variants[vi++ % variants.length]);
  });
  while (vi < variants.length) all.push(variants[vi++]);

  const rows: Phrase[][] = [[], [], []];
  all.forEach((p, i) => rows[i % 3].push(p));
  return rows.map((r, ri) => {
    const base = r.length ? r : [variants[ri % variants.length]];
    // Rotate row start so the three rows don't line up.
    const out: Phrase[] = [];
    while (out.length < 5) out.push(...base);
    return out;
  });
}

export function CommentStrike({ keywords, stats }: { keywords: string[]; stats: LandingData["stats"] }) {
  const sectionRef = useRef<HTMLElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const rows = useMemo(() => buildRows(keywords), [keywords]);
  const showStat = stats.commentReels > 0;

  // Strike lines draw when the marquee scrolls into view.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const target = el.querySelector(".cs-marquee");
    if (!target) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.dataset.in = "true";
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  // Count up the big number once.
  useEffect(() => {
    const el = numRef.current;
    if (!el || !showStat) return;
    const final = stats.commentSolved;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || final <= 0) return;
    el.textContent = "0";
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1200;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - t, 4);
          el.textContent = String(Math.round(final * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = String(final);
    };
  }, [stats.commentSolved, showStat]);

  return (
    <section ref={sectionRef} className="cs-section" aria-labelledby="cs-title">
      <RevealScope className="contents">
      <div className="lp-wrap">
        <div className="cs-head">
          <p className="lp-label" data-rv="rise">The problem</p>
          <h2 id="cs-title" className="lp-display cs-title" data-rv="words" aria-label="“Comment SKILL for the link.”">
            <span aria-hidden="true">
              <Words text="“Comment" /> <em><Words text="SKILL" start={1} /></em> <Words text="for the link.”" start={2} />
            </span>
          </h2>
          <p className="cs-sub" data-rv="rise" style={{ ["--rv-d" as string]: "260ms" }}>
            Half the AI tools on Instagram hide their link behind a comment, a DM or a link-in-bio page. Orphic reads the
            reel instead.
          </p>
        </div>
      </div>

      <div className="cs-marquee" aria-hidden="true" data-rv="spread">
        {rows.map((phrases, ri) => (
          <div key={ri} className="cs-row-wrap" style={{ ["--ri" as string]: ri }}>
          <div
            className="cs-row"
            data-dir={ri % 2 === 1 ? "rev" : "fwd"}
            style={{ ["--cs-dur" as string]: `${DURATIONS[ri]}s` }}
          >
            {[0, 1].map((g) => (
              <div key={g} className="cs-group">
                {phrases.map((p, pi) => (
                  <span key={`${p.id}-${pi}`} style={{ display: "contents" }}>
                    <span className="cs-phrase lp-display" style={{ ["--i" as string]: pi + ri }}>
                      {p.lead}
                      {p.kw}
                    </span>
                    <span className="cs-sep" />
                  </span>
                ))}
              </div>
            ))}
          </div>
          </div>
        ))}
      </div>
      <p className="cs-sr">
        Phrases creators use to hide links, struck through: comment a keyword, link in bio, DM me for the link, check the
        pinned comment.
      </p>

      {showStat && (
        <div className="lp-wrap">
          <div className="cs-stat" data-rv="stat">
            <p className="cs-num lp-display">
              <span ref={numRef}>{stats.commentSolved}</span>
              <span className="cs-of"> / {stats.commentReels}</span>
            </p>
            <p className="cs-copy" data-rv="rise" style={{ ["--rv-d" as string]: "380ms" }}>
              reels that said ‘comment X for the link’, solved: the real link found and checked, without commenting or
              waiting for a DM.
            </p>
          </div>
        </div>
      )}
      </RevealScope>
    </section>
  );
}
