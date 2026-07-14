"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

export function DiscoveryAiButton({ id, disabled }: { id: string; disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function score() {
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/discovery/${id}/ai-score`, { method: "POST" });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "AI仮評価に失敗しました。");
      router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "AI仮評価に失敗しました。"); }
    finally { setPending(false); }
  }
  return <div className="flex items-center gap-2"><button type="button" onClick={score} disabled={disabled || pending} className={buttonStyles("ghost", "h-8 px-2 text-xs")}>{pending ? <LoaderCircle size={13} className="animate-spin" /> : <Sparkles size={13} />}AI仮評価</button>{error ? <span className="max-w-36 truncate text-[10px] text-danger" title={error}>{error}</span> : null}</div>;
}
