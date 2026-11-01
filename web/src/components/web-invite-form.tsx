"use client";
import { useActionState } from "react";
import { addWebTeammate, type WebInviteState } from "@/app/actions";
import { CopyButton } from "./copy-button";

const field =
  "h-10 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink placeholder:text-subtle/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

export function WebInviteForm() {
  const [state, action, pending] = useActionState<WebInviteState, FormData>(addWebTeammate, null);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-2.5">
        <div>
          <label htmlFor="wi-name" className="mb-1 block text-xs font-medium text-subtle">Name</label>
          <input id="wi-name" name="name" required className={field} placeholder="Riya Sharma" />
        </div>
        <div>
          <label htmlFor="wi-email" className="mb-1 block text-xs font-medium text-subtle">Email</label>
          <input id="wi-email" name="email" type="email" required className={field} placeholder="riya@company.com" />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create web invite"}
        </button>
      </form>
      {state?.error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{state.error}</p>}
      {state?.link && (
        <div className="rounded-xl border border-line bg-sunken p-3" role="status">
          <p className="mb-2 text-sm text-subtle">
            Send this to {state.name} privately. It works once, for 7 days. They open it and choose their password.
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{state.link}</code>
            <CopyButton text={state.link} />
          </div>
        </div>
      )}
    </div>
  );
}
