"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export const NAV = [
  { href: "/app", label: "Search" },
  { href: "/pending", label: "Pending" },
  { href: "/team", label: "Team" },
  { href: "/connect-ai", label: "Connect AI" },
] as const;

export function NavLinks({ badges }: { badges?: Partial<Record<string, ReactNode>> }) {
  const pathname = usePathname();
  return <NavList active={(href) => (href === "/app" ? pathname === "/app" || pathname.startsWith("/tools") : pathname.startsWith(href))} badges={badges} />;
}

export function NavList({ active, badges }: { active?: (href: string) => boolean; badges?: Partial<Record<string, ReactNode>> }) {
  return (
    <ul className="flex items-center gap-0.5 overflow-x-auto">
      {NAV.map((n) => {
        const on = active?.(n.href) ?? false;
        return (
          <li key={n.href}>
            <Link
              href={n.href}
              aria-current={on ? "page" : undefined}
              className={
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition " +
                (on ? "bg-sunken text-ink" : "text-subtle hover:bg-sunken hover:text-ink")
              }
            >
              {n.label}
              {badges?.[n.href]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
