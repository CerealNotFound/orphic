"use client";
import { revokeApiKey } from "@/app/actions";

export function RevokeKeyButton({ keyId, name }: { keyId: string; name: string }) {
  return (
    <form
      action={revokeApiKey}
      onSubmit={(e) => {
        if (!confirm(`Revoke "${name}"? Anything using this key (Claude Code, Cursor, scripts) stops working immediately.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="keyId" value={keyId} />
      <button type="submit" className="rounded-md px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:ring-rose-900 dark:hover:bg-rose-950/50">
        Revoke
      </button>
    </form>
  );
}
