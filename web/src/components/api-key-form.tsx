"use client";
import { useActionState } from "react";
import { createMyApiKey, type ApiKeyState } from "@/app/actions";
import { CodeBlock, CopyButton } from "./copy-button";

export function ApiKeyForm({ mcpUrl }: { mcpUrl: string }) {
  const [state, action, pending] = useActionState<ApiKeyState, FormData>(createMyApiKey, null);
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="key-name" className="mb-1 block text-sm font-medium text-ink">
            Key name <span className="font-normal text-subtle">(optional, e.g. &ldquo;Laptop – Claude Code&rdquo;)</span>
          </label>
          <input
            id="key-name"
            name="name"
            maxLength={60}
            placeholder="My laptop"
            className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-subtle/70"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink shadow-sm transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create my API key"}
        </button>
      </form>
      {state?.error && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">
          {state.error}
        </p>
      )}
      {state?.key && (
        <div className="space-y-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40" role="status">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Your new key. Copy it now: it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
            <code className="min-w-0 flex-1 break-all font-mono text-sm text-ink">{state.key}</code>
            <CopyButton text={state.key} />
          </div>
          <p className="text-sm text-emerald-900 dark:text-emerald-200">Ready-to-paste for Claude Code:</p>
          <CodeBlock
            title="Terminal"
            code={`claude mcp add --transport http orphic ${mcpUrl} --header "Authorization: Bearer ${state.key}"`}
          />
        </div>
      )}
    </div>
  );
}
