"use client";
// "Made by" card. The whole card is the link. Hover: the name is plucked like a lyre string (letters ripple),
// a pomegranate string draws underneath and settles, a soft light follows the pointer, and the arrow button
// fills and swaps its arrow. On first view the name rises out of a blur, letter by letter.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import "./maker-card.css";

/** Tracks the pointer for the card's spotlight (CSS vars --mx/--my). Shared by both cards. */
export function Spotlight({ className = "", children, as = "div", href }: { className?: string; children: ReactNode; as?: "div" | "a"; href?: string }) {
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  if (as === "a")
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`mk-spot ${className}`} onPointerMove={onMove}>
        {children}
      </a>
    );
  return (
    <div className={`mk-spot ${className}`} onPointerMove={onMove}>
      {children}
    </div>
  );
}

export function MakerCard({ name, contact }: { name: string; contact: { label: string; href: string } | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const letters = [...name].map((ch, i) => (
    <span key={i} className="mk-l" style={{ ["--i" as string]: i }} aria-hidden="true">
      {ch === " " ? " " : ch}
    </span>
  ));

  const body = (
    <>
      <div>
        <p className="lp-label">Made by</p>
        <div ref={ref} className="mk-name-wrap" data-in={seen ? "true" : "false"}>
          <p className="lp-display mk-name">
            <span className="sr-only">{name}</span>
            {letters}
          </p>
          <span className="mk-string" aria-hidden="true" />
        </div>
        <p className="mk-copy">Building Orphic in the open. Say hi, suggest a tool, or tell me what to build next.</p>
      </div>
      {contact && (
        <span className="mk-foot">
          <span className="lp-mono mk-domain">{contact.label}</span>
          <span className="mk-btn" aria-hidden="true">
            <span className="mk-btn-fill" />
            <svg className="mk-arr mk-arr-out" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
            </svg>
            <svg className="mk-arr mk-arr-in" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.5 11.5l7-7M6 4.5h5.5V10" />
            </svg>
          </span>
        </span>
      )}
    </>
  );

  return contact ? (
    <Spotlight as="a" href={contact.href} className="mk-card" aria-label={`${name}, ${contact.label}`}>
      {body}
    </Spotlight>
  ) : (
    <Spotlight className="mk-card">{body}</Spotlight>
  );
}
