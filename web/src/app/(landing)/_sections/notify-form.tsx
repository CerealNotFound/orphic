"use client";
// "Tell me when it opens": the existing waitlist action, styled for the landing page.
import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "../actions";

export function NotifyForm() {
  const [state, action, pending] = useActionState<WaitlistState, FormData>(joinWaitlist, null);
  if (state?.ok)
    return (
      <p role="status" className="lp-mono rounded-[14px] border border-[var(--hair-2)] px-5 py-4 text-[13px] text-[var(--bone)]">
        You&apos;re on the list. The next playbook lands in your inbox.
      </p>
    );
  return (
    <form action={action} className="w-full max-w-[30rem]">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor="nf-email" className="sr-only">
          Email
        </label>
        <input
          id="nf-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@studio.com"
          className="h-12 w-full rounded-full border border-[var(--hair-2)] bg-[var(--ink-2)] px-5 text-[15px] text-[var(--bone)] outline-none transition-[border-color] duration-200 placeholder:text-[var(--dust)] focus:border-[var(--pom)] sm:flex-1"
        />
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button type="submit" disabled={pending} className="lp-btn h-12 justify-center disabled:opacity-60">
          {pending ? "Joining…" : "Join the list"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--pom)]">
          {state.error}
        </p>
      )}
      <p className="lp-mono mt-3 text-[11.5px] text-[var(--dust)]">No spam, ever. Unsubscribe any time.</p>
    </form>
  );
}
