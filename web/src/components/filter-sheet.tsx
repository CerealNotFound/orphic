"use client";
// Phone filters: one "Filters" button that opens a bottom sheet. Choosing a filter navigates and closes the sheet.
import Link from "next/link";
import { useEffect, useRef } from "react";

export function FilterSheet({ activeCount, clearHref, children }: { activeCount: number; clearHref: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    // Tap on the dark backdrop closes the sheet.
    const onClick = (e: MouseEvent) => {
      if (e.target === d) d.close();
      if ((e.target as HTMLElement).closest("a")) d.close();
    };
    d.addEventListener("click", onClick);
    return () => d.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-sm font-medium text-ink shadow-sm"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
        </svg>
        Filters
        {activeCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-ink">{activeCount}</span>}
      </button>
      <dialog
        ref={ref}
        aria-label="Filters"
        className="m-0 mt-auto max-h-[80vh] w-full max-w-none rounded-t-3xl border-t border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/40 open:animate-[sheet_.18s_ease-out]"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-line bg-card px-5 py-3">
          <span className="mx-auto h-1 w-10 rounded-full bg-line absolute left-1/2 top-1.5 -translate-x-1/2" aria-hidden="true" />
          <h2 className="text-base font-semibold">Filters</h2>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <Link href={clearHref} className="text-sm text-subtle underline-offset-4 hover:underline">
                Clear all
              </Link>
            )}
            <button type="button" onClick={() => ref.current?.close()} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas">
              Done
            </button>
          </div>
        </div>
        <div className="space-y-5 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </dialog>
    </>
  );
}
