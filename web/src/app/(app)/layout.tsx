import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/auth-buttons";
import { NavLinks, NavList } from "@/components/nav-links";
import { Avatar, Logo } from "@/components/ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { currentMember, openTaskCount } from "@/lib/ui-data";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:flex-nowrap sm:px-6">
          <Link href="/app" className="rounded-lg py-1" aria-label="Orphic home">
            <Logo className="text-lg" />
          </Link>
          <nav aria-label="Main" className="order-3 -mx-2 w-full sm:order-none sm:mx-0 sm:w-auto">
            <Suspense fallback={<NavList />}>
              <Nav />
            </Suspense>
          </nav>
          <div className="ml-auto">
            <Suspense fallback={<span className="block size-8 rounded-full bg-sunken" />}>
              <UserMenu />
            </Suspense>
          </div>
        </div>
      </header>
      <AutoRefresh />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-xs text-subtle sm:px-6">
        Orphic · your team&apos;s memory of what you spot in reels
      </footer>
    </>
  );
}

async function Nav() {
  const { member } = await currentMember();
  const pending = await openTaskCount(member.id);
  return (
    <NavLinks
      badges={{
        "/pending":
          pending > 0 ? (
            <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold tabular-nums text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
              {pending}
              <span className="sr-only"> open</span>
            </span>
          ) : null,
      }}
    />
  );
}

async function UserMenu() {
  const { name, email, member } = await currentMember();
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-0.5 [&::-webkit-details-marker]:hidden" aria-label="Account menu">
        <Avatar name={member.display_name || name} />
      </summary>
      <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-line bg-card p-1.5 shadow-lg">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium text-ink">{member.display_name}</p>
          <p className="truncate text-xs text-subtle">{email}</p>
          <p className="mt-0.5 text-xs capitalize text-subtle">{member.role}</p>
        </div>
        <div className="my-1 border-t border-line" />
        <Link href="/connect-ai" className="block rounded-lg px-2.5 py-1.5 text-sm text-ink hover:bg-sunken">
          API keys &amp; AI tools
        </Link>
        <SignOutButton className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-ink hover:bg-sunken" />
      </div>
    </details>
  );
}
