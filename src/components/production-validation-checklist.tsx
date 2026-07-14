"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Run = { id: string; status: string; evidence_note: string | null; verified_by: string; verified_at: string };
type Item = { id: string; code: string; label: string; description: string | null; validation_checklist_runs: Run[] };
const labels: Record<string, string> = { not_run: "未実施", passed: "成功", failed: "失敗", recheck: "再確認必要" };
export function ProductionValidationChecklist({ items }: { items: Item[] }) { return <div className="mt-7 grid gap-4 xl:grid-cols-2">{items.map((item) => <ValidationItem key={item.id} item={item} />)}</div>; }
function ValidationItem({ item }: { item: Item }) {
  const last = item.validation_checklist_runs[0]; const [status, setStatus] = useState(last?.status ?? "not_run"); const [evidence, setEvidence] = useState(last?.evidence_note ?? ""); const [pending, setPending] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function save() { setPending(true); setMessage(null); try { const response = await fetch("/api/production-validation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ checklist_id: item.id, status, evidence_note: evidence }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "保存できませんでした。"); setMessage("検証履歴を保存しました。"); } catch (error) { setMessage(error instanceof Error ? error.message : "保存できませんでした。"); } finally { setPending(false); } }
  return <article className="rounded-xl border bg-surface p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[9px] text-muted">{item.code}</p><h2 className="mt-1 text-sm font-medium">{item.label}</h2></div><span className="rounded-full border px-2 py-1 text-[10px]">{labels[last?.status ?? "not_run"]}</span></div>{item.description ? <p className="mt-2 text-xs text-muted">{item.description}</p> : null}<div className="mt-4 grid gap-3 sm:grid-cols-[160px_1fr]"><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border bg-white px-3 text-xs">{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input value={evidence} onChange={(event) => setEvidence(event.target.value)} maxLength={5000} placeholder="証跡メモ（URL、実行ID、確認内容）" className="h-10 rounded-lg border bg-white px-3 text-xs" /></div><div className="mt-3 flex items-center gap-3"><Button variant="secondary" disabled={pending} onClick={save}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}履歴を追加</Button>{last ? <p className="text-[10px] text-muted">最終確認 {new Date(last.verified_at).toLocaleString("ja-JP")} · 確認者 {last.verified_by.slice(0, 8)}…</p> : null}</div>{message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}</article>;
}
