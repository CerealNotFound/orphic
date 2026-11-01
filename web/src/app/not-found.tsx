import Link from "next/link";
import { Logo, btn } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Logo className="text-xl" />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight text-ink">Not found</h1>
      <p className="mt-2 max-w-sm text-sm text-subtle">That page or item doesn&apos;t exist in your team&apos;s Orphic. It may have been merged or renamed.</p>
      <Link href="/" className={`${btn.primary} mt-6`}>
        Back to search
      </Link>
    </main>
  );
}
