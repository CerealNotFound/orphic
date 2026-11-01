import type { Metadata } from "next";
import { Suspense } from "react";
import { connectAccount } from "@/app/actions";
import { EmailSignInForm, GoogleSignInButton, SignOutButton } from "@/components/auth-buttons";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { SetPasswordForm } from "@/components/set-password-form";
import { Skeleton, btn } from "@/components/ui";
import { googleConfigured } from "@/lib/auth";
import { peekLinkToken } from "@/lib/link-tokens";
import { getSessionUser } from "@/lib/ui-data";

export const metadata: Metadata = { title: "Connect your account" };

export default function ConnectPage({ searchParams }: PageProps<"/connect">) {
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
      <Connect searchParams={searchParams} />
    </Suspense>
  );
}

function Expired({ failed }: { failed?: boolean }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">{failed ? "That didn't work" : "This link has expired"}</h1>
      <p className="mt-2 text-sm leading-relaxed text-subtle">
        Connect links work once and only for 30 minutes. In Telegram, send{" "}
        <kbd className="rounded border border-line bg-sunken px-1 font-mono text-ink">/web</kbd> to the Orphic bot again to get a fresh one.
      </p>
    </div>
  );
}

async function Connect({ searchParams }: { searchParams: PageProps<"/connect">["searchParams"] }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const failed = sp.failed === "1";
  const link = token ? await peekLinkToken(token) : null;
  if (!link) return <Expired failed={failed} />;

  const user = await getSessionUser();
  const first = link.display_name.split(" ")[0];

  if (!user && link.login_email) {
    // They already have a login: sign in, or set a new password if they forgot it.
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Hi {first}! 👋</h1>
        <p className="mt-2 text-sm leading-relaxed text-subtle">
          You already have an Orphic login: <span className="font-medium text-ink">{link.login_email}</span>
        </p>
        <h2 className="mt-6 text-sm font-semibold text-ink">Forgot your password? Set a new one</h2>
        <p className="mt-1 text-xs text-subtle">This signs you out everywhere else.</p>
        <div className="mt-3">
          <ResetPasswordForm token={token} email={link.login_email} />
        </div>
        <details className="mt-6 text-sm text-subtle">
          <summary className="cursor-pointer">Remembered it? Sign in instead</summary>
          <div className="mt-3">
            <EmailSignInForm callbackURL="/app" />
          </div>
        </details>
      </div>
    );
  }

  if (!user) {
    const configured = googleConfigured();
    const back = `/connect?token=${encodeURIComponent(token)}`;
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Hi {first}! 👋</h1>
        <p className="mt-2 text-sm leading-relaxed text-subtle">
          Create your Orphic login. After this you can open Orphic on the web any time with your email and password.
        </p>
        <div className="mt-6">
          <SetPasswordForm token={token} />
        </div>
        <details className="mt-6 text-sm text-subtle">
          <summary className="cursor-pointer">Already have an Orphic login?</summary>
          <div className="mt-3">
            <EmailSignInForm callbackURL={back} />
          </div>
        </details>
        {configured && (
          <div className="mt-6 border-t border-line pt-6">
            <GoogleSignInButton callbackURL={back} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Connect your account</h1>
      <p className="mt-2 text-sm leading-relaxed text-subtle">
        Connect the account <span className="font-medium text-ink">{user.email}</span> to the Orphic teammate{" "}
        <span className="font-medium text-ink">{link.display_name}</span>?
      </p>
      {failed && (
        <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-400">
          Something went wrong. Please try again.
        </p>
      )}
      <form action={connectAccount} className="mt-6">
        <input type="hidden" name="token" value={token} />
        <button type="submit" className={`${btn.primary} w-full py-3`}>
          Connect {user.email} to {first}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-subtle">Not you?</p>
      <SignOutButton className={`${btn.ghost} mt-1 w-full`}>Sign out and use another account</SignOutButton>
    </div>
  );
}
