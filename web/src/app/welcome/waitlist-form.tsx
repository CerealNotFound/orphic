"use client";
import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "./actions";

export function WaitlistForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, null);
  if (state?.ok)
    return (
      <p role="status" className="rounded-2xl border border-line bg-card px-5 py-4 text-sm text-ink">
        You&apos;re on the list. We&apos;ll email you when Orphic opens up. 🎉
      </p>
    );
  return (
    <form action={action} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="wl-email" className="sr-only">Email</label>
        <input
          id="wl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="h-12 w-full rounded-xl border border-line bg-card px-4 sm:flex-1 text-[15px] text-ink placeholder:text-subtle/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
        />
        {/* Hidden from people, irresistible to bots */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xl bg-accent px-6 text-[15px] font-medium text-accent-ink shadow-sm transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Joining…" : "Get early access"}
        </button>
      </div>
      {state?.error && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
      <p className="mt-2 text-xs text-subtle">One email when it opens. No spam.</p>
    </form>
  );
}
