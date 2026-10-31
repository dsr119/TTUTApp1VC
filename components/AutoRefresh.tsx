"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-fetches server data on an interval while the tab is visible. Stand-in for
// websockets until the app moves to AWS (API Gateway WebSockets or AppSync).
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
