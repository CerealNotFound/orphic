"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const primary =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-canvas shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export function GoogleSignInButton({ callbackURL = "/app", disabled }: { callbackURL?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="w-full">
      <button
        type="button"
        className={primary}
        disabled={disabled || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await authClient.signIn.social({ provider: "google", callbackURL });
          if (res?.error) {
            setError(res.error.message ?? "Sign-in failed. Please try again.");
            setBusy(false);
          }
        }}
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
          <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" />
        </svg>
        {busy ? "Opening Google…" : "Sign in with Google"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function SignOutButton({ className, children = "Sign out" }: { className?: string; children?: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await authClient.signOut();
        router.push("/signin");
        router.refresh();
      }}
    >
      {busy ? "Signing out…" : children}
    </button>
  );
}

const field =
  "h-11 w-full rounded-xl border border-line bg-card px-3.5 text-sm text-ink placeholder:text-subtle/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

export function EmailSignInForm({ callbackURL = "/app" }: { callbackURL?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        const res = await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) });
        if (res.error) {
          setError(res.error.status === 401 ? "Wrong email or password." : (res.error.message ?? "Sign-in failed."));
          setBusy(false);
          return;
        }
        router.push(callbackURL);
        router.refresh();
      }}
    >
      <div>
        <label htmlFor="email" className="mb-1 block text-xs font-medium text-subtle">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-xs font-medium text-subtle">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className={field} />
      </div>
      {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{error}</p>}
      <button type="submit" className={primary} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
