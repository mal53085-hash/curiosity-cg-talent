"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, ExternalLink, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";

export function VisualSearchControls({ searchId, showOpen = false, compact = false }: { searchId: string; showOpen?: boolean; compact?: boolean }) {
  const router = useRouter(); const [action, setAction] = useState<"rerun" | "duplicate" | "delete" | null>(null); const [error, setError] = useState("");
  const size = compact ? "h-8 px-2 text-[11px]" : "h-9 px-3 text-xs";
  async function rerun() { setAction("rerun"); setError(""); try { const response = await fetch(`/api/visual-search/${searchId}/run`, { method: "POST", headers: { "content-type": "application/json" } }); const body = await response.json(); if (!response.ok) throw new Error(body.error); router.push(`/visual-search/${searchId}`); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "再実行できませんでした。"); } finally { setAction(null); } }
  async function duplicate() { setAction("duplicate"); setError(""); try { const response = await fetch(`/api/visual-search/${searchId}/duplicate`, { method: "POST", headers: { "content-type": "application/json" } }); const body = await response.json(); if (!response.ok) throw new Error(body.error); router.push(`/visual-search/${body.id}`); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "複製できませんでした。"); } finally { setAction(null); } }
  async function remove() { if (!window.confirm("特徴量、分析結果、検索履歴を削除しますか？")) return; setAction("delete"); setError(""); try { const response = await fetch(`/api/visual-search/${searchId}`, { method: "DELETE" }); const body = await response.json(); if (!response.ok) throw new Error(body.error); router.push("/visual-search"); router.refresh(); } catch (reason) { setError(reason instanceof Error ? reason.message : "削除できませんでした。"); } finally { setAction(null); } }
  return <div><div className="flex flex-wrap items-center gap-2">{showOpen ? <Link href={`/visual-search/${searchId}`} className={buttonStyles("secondary", size)}><ExternalLink size={13}/>結果を見る</Link> : null}<button type="button" onClick={rerun} disabled={action !== null} className={buttonStyles("secondary", size)}>{action === "rerun" ? <Loader2 size={13} className="animate-spin"/> : <RotateCcw size={13}/>}再実行</button><button type="button" onClick={duplicate} disabled={action !== null} className={buttonStyles("ghost", size)}>{action === "duplicate" ? <Loader2 size={13} className="animate-spin"/> : <Copy size={13}/>}複製</button><button type="button" onClick={remove} disabled={action !== null} className={buttonStyles("ghost", `${size} text-danger`)}>{action === "delete" ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}削除</button></div>{error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}</div>;
}
