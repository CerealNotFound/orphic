"use client";
// Top bar: transparent over the hero, a quiet translucent bar once you scroll (the page's one glass element).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MagneticButton } from "./buttons";
import { Wordmark } from "./lyre";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/explore", label: "Catalogue" },
  { href: "/#ai", label: "For AIs" },
  { href: "/#open-source", label: "Open source" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>(".cd-input");
        if (input && location.pathname === "/explore") input.focus();
        else router.push("/explore#search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300"
      style={{
        background: scrolled ? "rgba(11,10,8,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(14px) saturate(1.2)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--hair)" : "transparent"}`,
      }}
    >
      <nav className="lp-wrap flex h-16 items-center justify-between" aria-label="Main">
        <Link href="/" aria-label="Orphic home">
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-8 text-[14px] text-[var(--ash)] md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="transition-colors duration-200 hover:text-[var(--bone)]">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-5">
          <MagneticButton href="/explore#search" label="Search tools" icon="search" size="sm" kbd="⌘K" />
        </div>
      </nav>
    </header>
  );
}
