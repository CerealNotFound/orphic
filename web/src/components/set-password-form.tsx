"use client";
import { useActionState } from "react";
import { createPasswordAccount, type PasswordAccountState } from "@/app/actions";

const field =
  "h-11 w-full rounded-xl border border-line bg-card px-3.5 text-sm text-ink placeholder:text-subtle/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<PasswordAccountState, FormData>(createPasswordAccount, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="new-email" className="mb-1 block text-xs font-medium text-subtle">Email</label>
        <input id="new-email" name="email" type="email" autoComplete="email" required className={field} />
      </div>
      <div>
        <label htmlFor="new-password" className="mb-1 block text-xs font-medium text-subtle">Choose a password (8+ characters)</label>
        <input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} className={field} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-5 py-3 text-sm font-medium text-canvas shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Creating your login…" : "Create my login"}
      </button>
    </form>
  );
}
