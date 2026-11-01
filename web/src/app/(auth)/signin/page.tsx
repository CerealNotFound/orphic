import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmailSignInForm, GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { Skeleton, btn } from "@/components/ui";
import { getViewer, googleConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-16" />
          <Skeleton className="h-11" />
        </div>
      }
    >
      <SignIn searchParams={searchParams} />
    </Suspense>
  );
}

async function SignIn({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const { unlinked } = await searchParams;
  const viewer = await getViewer();

  if (viewer?.member) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">You&apos;re signed in</h1>
        <p className="mt-2 text-sm text-subtle">
          Signed in as <span className="font-medium text-ink">{viewer.member.display_name}</span>
          {viewer.email && <> ({viewer.email})</>}.
        </p>
        <Link href="/" className={`${btn.primary} mt-6 w-full`}>
          Open Orphic →
        </Link>
      </div>
    );
  }

  if (viewer && (unlinked || !viewer.member)) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Almost there</h1>
        <p className="mt-3 text-sm leading-relaxed text-subtle">
          Signed in as <span className="font-medium text-ink">{viewer.email}</span>, but this login isn&apos;t connected to a teammate yet.
        </p>
        <ol className="mt-4 space-y-2 rounded-xl bg-sunken p-4 text-sm text-ink">
          <li>
            1. In Telegram, send <kbd className="rounded border border-line bg-card px-1 font-mono">/web</kbd> to the Orphic bot.
          </li>
          <li>2. Tap the link it sends you and confirm.</li>
        </ol>
        <p className="mt-4 text-sm text-subtle">Wrong account?</p>
        <SignOutButton className={`${btn.secondary} mt-2 w-full`}>Sign out</SignOutButton>
      </div>
    );
  }

  const configured = googleConfigured();
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Welcome to Orphic</h1>
      <p className="mt-2 text-sm leading-relaxed text-subtle">
        Your team&apos;s memory of the AI tools, workflows and prompts you spot in reels. Share a reel to the Orphic bot; find it here later, with the real
        link and who tried it.
      </p>
      <div className="mt-6">
        <EmailSignInForm callbackURL="/" />
      </div>
      {configured && (
        <div className="mt-4">
          <GoogleSignInButton callbackURL="/" />
        </div>
      )}
      <p className="mt-6 text-xs leading-relaxed text-subtle">
        First time? In Telegram, send <kbd className="rounded border border-line bg-sunken px-1 font-mono">/web</kbd> to the Orphic bot to get a link where
        you create your email and password.
      </p>
    </div>
  );
}
