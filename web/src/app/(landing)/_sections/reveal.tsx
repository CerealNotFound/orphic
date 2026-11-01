"use client";
// Scroll reveals for the landing sections. One IntersectionObserver for the whole page; each `[data-rv]` group
// inside a <RevealScope> gets data-in="true" once, just before it's fully on screen. CSS (reveal.css) does the motion.
// Progressive: content is only hidden after this script arms the scope, and anything already on screen when it
// arms stays put (no flash). Reduced motion: nothing is ever hidden.
import { useLayoutEffect, useRef, type ElementType, type ReactNode } from "react";
import "./reveal.css";

let io: IntersectionObserver | null = null;
function observer() {
  io ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.in = "true";
        io!.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -14% 0px" },
  );
  return io;
}

export function RevealScope({ as: Tag = "div", className, children, ...rest }: { as?: ElementType; className?: string; children: ReactNode; [k: string]: unknown }) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const groups = [...(root.matches("[data-rv]") ? [root] : []), ...root.querySelectorAll<HTMLElement>("[data-rv]")];
    const vh = window.innerHeight;
    for (const g of groups) {
      const r = g.getBoundingClientRect();
      if (r.top < vh * 0.86 && r.bottom > 0) g.dataset.in = "true"; // already visible: leave it as it is
      else observer().observe(g);
    }
    root.dataset.rvArmed = "true";
    return () => groups.forEach((g) => io?.unobserve(g));
  }, []);
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}

/** A display heading split into words that rise out of a mask. Layout is identical with or without JS. */
export function Words({ text, start = 0 }: { text: string; start?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="rv-w">
            <span className="rv-wi" style={{ ["--wi" as string]: start + i }}>
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}
