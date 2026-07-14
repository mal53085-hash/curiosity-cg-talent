"use client";

import { useState } from "react";
import { Check, DatabaseZap, Loader2, X } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { fieldControlClass } from "@/components/ui/field";

type RecordOption = { id: string; name: string };
const fields = [
  ["skills", "スキル"], ["software", "使用ソフト"], ["languages", "言語"], ["country", "地域"],
  ["employment_types", "契約形態"], ["work_location_preferences", "勤務地希望"], ["tags", "タグ"],
  ["project_fit_tags", "案件適性"],
] as const;

export function BulkEnrichment({ kind, records }: { kind: "candidates" | "discovery"; records: RecordOption[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [field, setField] = useState<(typeof fields)[number][0]>("skills");
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!records.length) return null;
  const submit = async () => {
    setBusy(true); setMessage("");
    const response = await fetch("/api/data-quality/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, ids: selected, field, values: value.split(/[,、\n]/).map((v) => v.trim()).filter(Boolean) }) });
    const payload = await response.json().catch(() => ({}));
    setBusy(false); setConfirming(false); setMessage(response.ok ? `${selected.length}件を更新しました。` : payload.error ?? "更新できませんでした。");
    if (response.ok) { setSelected([]); setValue(""); window.location.reload(); }
  };
  return <section className="mt-5 rounded-xl border bg-surface p-4">
    <div className="flex items-center gap-2"><DatabaseZap size={15} /><h2 className="text-sm font-medium">不足情報の一括編集</h2><span className="text-xs text-muted">追加方式・最大50件</span></div>
    <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(220px,1fr)_180px_minmax(220px,1fr)_auto]">
      <select multiple value={selected} onChange={(e) => setSelected(Array.from(e.target.selectedOptions, (o) => o.value))} className={`${fieldControlClass} min-h-24`} aria-label="対象を選択">
        {records.map((record) => <option key={record.id} value={record.id}>{record.name}</option>)}
      </select>
      <select value={field} onChange={(e) => setField(e.target.value as typeof field)} className={fieldControlClass}>{fields.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} className={`${fieldControlClass} min-h-24`} placeholder="カンマまたは改行区切り" maxLength={1000} />
      <button type="button" disabled={!selected.length || !value.trim()} onClick={() => setConfirming(true)} className={buttonStyles("secondary", "self-end disabled:opacity-40")}>確認へ</button>
    </div>
    {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
    {confirming ? <div className="fixed inset-0 z-[70] grid place-items-center bg-black/30 p-4"><div className="w-full max-w-md rounded-2xl border bg-background p-6 shadow-2xl"><h3 className="text-lg font-medium">一括変更を確認</h3><p className="mt-3 text-sm leading-6 text-muted">{selected.length}件の「{fields.find(([key]) => key === field)?.[1]}」に、入力値を追加します。既存値は保持されます。</p><div className="mt-5 flex justify-end gap-2"><button className={buttonStyles("ghost")} onClick={() => setConfirming(false)}><X size={14}/>戻る</button><button className={buttonStyles()} onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={14}/> : <Check size={14}/>}変更を実行</button></div></div></div> : null}
  </section>;
}
