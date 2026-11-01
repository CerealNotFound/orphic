"use client";
// Search as you type: updates the results in place (no page reload), keeps the current filters.
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function LiveSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = (q: string) => {
    const next = new URLSearchParams(params.toString());
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    next.delete("offset");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  return (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
    >
      <label htmlFor="q" className="sr-only">
        Search tools, workflows and prompts
      </label>
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden="true">
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" strokeLinecap="round" />
      </svg>
      <input
        id="q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go(e.target.value), 250);
        }}
        placeholder={placeholder}
        autoComplete="off"
        className="h-14 w-full rounded-2xl border border-line bg-card pl-12 pr-28 text-base text-ink shadow-sm placeholder:text-subtle/70 focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-subtle" aria-live="polite">
        {pending ? "Searching…" : ""}
      </span>
    </form>
  );
}
