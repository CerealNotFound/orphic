"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={
        className ??
        "inline-flex shrink-0 items-center rounded-md border border-line bg-card px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-sunken"
      }
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copy this:", text);
        }
      }}
    >
      <span aria-live="polite">{copied ? "Copied ✓" : label}</span>
    </button>
  );
}

/** A code block with a copy button. */
export function CodeBlock({ code, title }: { code: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-sunken">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5">
        <span className="truncate font-mono text-xs text-subtle">{title ?? ""}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code className="font-mono text-ink">{code}</code>
      </pre>
    </div>
  );
}
