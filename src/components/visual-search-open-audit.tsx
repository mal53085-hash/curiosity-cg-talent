"use client";

import { useEffect } from "react";

export function VisualSearchOpenAudit({ searchId }: { searchId: string }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/visual-search/${searchId}/opened`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", cache: "no-store", signal: controller.signal }).catch(() => undefined);
    return () => controller.abort();
  }, [searchId]);
  return null;
}

