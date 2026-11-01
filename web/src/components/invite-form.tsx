"use client";
import { useActionState } from "react";
import { createInviteLink, type InviteState } from "@/app/actions";
import { CopyButton } from "./copy-button";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState>(createInviteLink, null);
  return (
    <div className="space-y-3">
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : state?.code ? "Create another invite link" : "Create invite link"}
        </button>
      </form>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
          {state.error}
        </p>
      )}
      {state?.link && (
        <div className="rounded-xl border border-line bg-sunken p-3" role="status">
          <p className="mb-2 text-sm text-subtle">Send this to a teammate. It opens the Orphic bot in Telegram and adds them to the team (up to 50 uses).</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{state.link}</code>
            <CopyButton text={state.link} />
          </div>
        </div>
      )}
      {state?.code && !state.link && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200" role="status">
          <p>
            Invite code created: <code className="font-mono font-semibold">{state.code}</code>
          </p>
          <p className="mt-1">
            The bot username isn&apos;t configured (<code className="font-mono">TELEGRAM_BOT_USERNAME</code>), so a full link can&apos;t be built. Teammates can
            send <code className="font-mono">/start {state.code}</code> to the bot.
          </p>
          <div className="mt-2">
            <CopyButton text={`/start ${state.code}`} label="Copy /start command" />
          </div>
        </div>
      )}
    </div>
  );
}
