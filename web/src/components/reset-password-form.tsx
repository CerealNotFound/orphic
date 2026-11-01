"use client";
import { useActionState } from "react";
import { resetPasswordWithLink, type PasswordAccountState } from "@/app/actions";

const field =
  "h-11 w-full rounded-xl border border-line bg-card px-3.5 text-sm text-ink placeholder:text-subtle/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<PasswordAccountState, FormData>(resetPasswordWithLink, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {/* Lets password managers save the new password under the right email. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div>
        <label htmlFor="reset-password" className="mb-1 block text-xs font-medium text-subtle">New password (8+ characters)</label>
        <input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={field} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-xl bg-ink px-5 py-3 text-sm font-medium text-canvas shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save new password and sign in"}
      </button>
    </form>
  );
}
