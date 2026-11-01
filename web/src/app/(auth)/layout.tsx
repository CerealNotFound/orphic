import Link from "next/link";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8 rounded-lg" aria-label="Orphic home">
        <Logo className="text-2xl" />
      </Link>
      <div className="w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-subtle">Orphic keeps your team&apos;s finds from reels in one place, with real links.</p>
    </main>
  );
}
