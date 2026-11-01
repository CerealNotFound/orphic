"use client";
// Keeps pages current without reloading: refetches server data every 15 s while the tab is visible, and when you come back to the tab.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [router, seconds]);
  return null;
}
