"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { RevealScope, Words } from "./reveal";
import "./catalogue-demo.css";

type Seg = [string, "s" | "u" | "k" | ""];
type Tab = { id: string; label: string; note?: string; copy: string; segs: Seg[] };

const MCP = "https://orphic.adarshji.com/api/public/mcp";
const TABS: Tab[] = [
  {
    id: "claude",
    label: "Claude Code",
    copy: `claude mcp add --transport http orphic ${MCP}`,
    segs: [["claude mcp add --transport http orphic ", "k"], [MCP, "u"]],
  },
  {
    id: "cursor",
    label: "Cursor",
    note: "~/.cursor/mcp.json",
    copy: `{\n  "mcpServers": {\n    "orphic": { "url": "${MCP}" }\n  }\n}`,
    segs: [
      ["{\n  ", ""], ['"mcpServers"', "k"], [": {\n    ", ""], ['"orphic"', "k"], [": { ", ""], ['"url"', "k"], [": ", ""],
      [`"${MCP}"`, "u"], [" }\n  }\n}", ""],
    ],
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    copy: `Settings → Connectors → Add custom connector → ${MCP}`,
    segs: [["Settings → Connectors → Add custom connector → ", "s"], [MCP, "u"]],
  },
  {
    id: "script",
    label: "Any script",
    copy: `curl "https://orphic.adarshji.com/api/public/search?q=video+ads"`,
    segs: [["curl ", "k"], ['"', "s"], ["https://orphic.adarshji.com/api/public/search?q=video+ads", "u"], ['"', "s"]],
  },
];

export type AISample = { query: string; total: number; items: { name: string; domain: string | null }[] };

const ASKS = ["Find me a free tool for AI avatar videos", "Which Claude skill is best for motion graphics?", "List every tool for video ads, with links"];

export function AnyAI({ sample }: { sample: AISample | null }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [ind, setInd] = useState({ x: 0, w: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    const el = refs.current[active];
    if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth });
  }, [active]);
  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const tab = TABS[active];

  function onKey(e: React.KeyboardEvent) {
    let n = active;
    if (e.key === "ArrowRight") n = (active + 1) % TABS.length;
    else if (e.key === "ArrowLeft") n = (active - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = TABS.length - 1;
    else return;
    e.preventDefault();
    setActive(n);
    refs.current[n]?.focus();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(tab.copy);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="ai-section" aria-labelledby="ai-title">
      <RevealScope className="lp-wrap ai-grid">
        <div>
          <p className="lp-label" data-rv="rise">For your AI</p>
          <h2 id="ai-title" className="lp-display ai-title" data-rv="words" aria-label="Ask from any AI. No key, no sign-up.">
            <span aria-hidden="true">
              <Words text="Ask from any AI. No key, no sign-up." />
            </span>
          </h2>
          <p className="ai-sub" data-rv="rise" style={{ ["--rv-d" as string]: "220ms" }}>One open MCP server for Claude, ChatGPT, Cursor or any agent, plus a plain search API for scripts. Both are live, free and need no key.</p>
          <p className="lp-label ai-asks-label">Then just ask</p>
          <ul className="ai-asks" data-rv="asks">
            {ASKS.map((a, i) => (
              <li key={a} style={{ ["--rv-i" as string]: i, ["--n" as string]: a.length + 3 }}>
                <span className="ai-asks-mark" aria-hidden="true">↳</span>&ldquo;{a}&rdquo;
              </li>
            ))}
          </ul>
        </div>
        <div className="ai-panel" data-rv="panel">
          <div className="ai-bar">
            <div className="ai-tabs" role="tablist" aria-label="Connect your AI" onKeyDown={onKey}>
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  ref={(el) => { refs.current[i] = el; }}
                  type="button"
                  role="tab"
                  id={`ai-tab-${t.id}`}
                  aria-selected={i === active}
                  aria-controls="ai-panel"
                  tabIndex={i === active ? 0 : -1}
                  className="ai-tab"
                  onClick={() => setActive(i)}
                >
                  {t.label}
                </button>
              ))}
              <span className="ai-ind" aria-hidden="true" style={{ transform: `translateX(${ind.x}px) scaleX(${ind.w})` }} />
            </div>
            <button type="button" className="ai-copy" data-done={copied} onClick={copy} aria-label={copied ? "Copied" : "Copy snippet"}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="ai-body" key={tab.id} role="tabpanel" id="ai-panel" aria-labelledby={`ai-tab-${tab.id}`} tabIndex={0}>
            {tab.note && <p className="ai-note">{tab.note}</p>}
            <pre className="ai-code">
              <code>
                {tab.segs.map(([text, kind], i) => (
                  <span key={i} className={kind ? `ai-${kind}` : undefined}>{text}</span>
                ))}
              </code>
            </pre>
          </div>
          {sample && (
            <div className="ai-resp">
              <p className="lp-label">What your AI gets back</p>
              <p className="lp-mono ai-resp-req">
                GET /api/public/search?q={sample.query.replace(/ /g, "+")}
                <span className="ai-resp-ok"> → 200 · {sample.total} results</span>
              </p>
              <ul className="ai-resp-list">
                {sample.items.map((it, i) => (
                  <li key={it.name} style={{ ["--i" as string]: i }}>
                    <span className="ai-resp-name">{it.name}</span>
                    <span className="lp-mono ai-resp-domain">{it.domain}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </RevealScope>
    </section>
  );
}
