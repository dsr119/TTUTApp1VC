"use client";

import { useEffect } from "react";

export function ScrollToBottom({ dep }: { dep: string | number }) {
  useEffect(() => {
    window.scrollTo({ top: document.body.scrollHeight });
  }, [dep]);
  return null;
}
