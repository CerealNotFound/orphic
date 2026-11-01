"use client";
// Landing buttons.
// MagneticButton: leans toward the pointer (springs back on leave), its label rolls letter by letter like a plucked
// string, and the icon chip slides one icon out while a fresh one slides in.
// ScrollCue: a ring with an arrow that drops through; smooth-scrolls to its target.
import Link from "next/link";
import { useRef, type PointerEvent, type ReactNode } from "react";
import "./buttons.css";

function Roll({ text }: { text: string }) {
  return (
    <span className="mg-roll" aria-hidden="true">
      {[...text].map((ch, i) => (
        <span key={i} className="mg-ch" style={{ ["--i" as string]: i }}>
          <span>{ch === " " ? " " : ch}</span>
          <span>{ch === " " ? " " : ch}</span>
        </span>
      ))}
    </span>
  );
}

const ICONS: Record<"search" | "arrow", ReactNode> = {
  search: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.2" />
      <path d="M10.2 10.2l3.3 3.3" />
    </svg>
  ),
  arrow: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  ),
};

export function MagneticButton({
  href,
  label,
  icon = "arrow",
  size = "lg",
  kbd,
  external = false,
}: {
  href: string;
  label: string;
  icon?: "search" | "arrow";
  size?: "lg" | "sm";
  kbd?: string;
  external?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const fine = () => typeof window !== "undefined" && window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches;

  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el || !fine()) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    el.style.setProperty("--tx", `${(dx * 0.22).toFixed(1)}px`);
    el.style.setProperty("--ty", `${(dy * 0.32).toFixed(1)}px`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty("--tx", "0px");
    ref.current?.style.setProperty("--ty", "0px");
  };

  const inner = (
    <span className="mg-body">
      <Roll text={label} />
      {kbd && <kbd className="mg-kbd">{kbd}</kbd>}
      <span className="mg-icon" aria-hidden="true">
        <span className="mg-i mg-i-out">{ICONS[icon]}</span>
        <span className="mg-i mg-i-in">{ICONS[icon]}</span>
      </span>
    </span>
  );
  if (external)
    return (
      <a ref={ref} href={href} target="_blank" rel="noopener noreferrer" className={`mg mg--${size}`} onPointerMove={onMove} onPointerLeave={onLeave} aria-label={label}>
        {inner}
      </a>
    );
  return (
    <Link ref={ref} href={href} className={`mg mg--${size}`} onPointerMove={onMove} onPointerLeave={onLeave} aria-label={label}>
      {inner}
    </Link>
  );
}

export function ScrollCue({ target, label }: { target: string; label: string }) {
  return (
    <a
      href={`#${target}`}
      className="sc"
      onClick={(e) => {
        const el = document.getElementById(target);
        if (!el) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", `#${target}`);
      }}
    >
      <span className="sc-ring" aria-hidden="true">
        <span className="sc-fill" />
        <svg className="sc-a sc-a-out" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v10M4 9l4 4 4-4" />
        </svg>
        <svg className="sc-a sc-a-in" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v10M4 9l4 4 4-4" />
        </svg>
      </span>
      <span className="sc-label">{label}</span>
    </a>
  );
}
