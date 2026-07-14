"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, Check, FileSpreadsheet, Link2, Loader2, Upload, UserPlus } from "lucide-react";
import {
  acquisitionFields,
  type AcquisitionField,
  type AcquisitionPreview,
  type AcquisitionPreviewRow,
  type ColumnMapping,
} from "@/types/acquisition";
import {
  defaultColumnMapping,
  forbiddenCsvColumns,
  identifyAcquisitionSource,
  normalizeCandidateUrl,
  parseCsv,
  splitAcquisitionList,
} from "@/lib/acquisition/import";
import { sourceTypeLabels, type DiscoverySourceType } from "@/types/discovery";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Mode = "url" | "csv" | "manual";
const fieldLabels: Record<AcquisitionField, string> = {
  name: "公開名", source_type: "ソース種別", source_url: "ソースURL", portfolio_url: "ポートフォリオURL",
  region: "地域", skills: "スキル", software: "使用ソフト", languages: "言語", employment_types: "契約形態",
  work_location_preferences: "勤務地希望", notes_for_review: "確認メモ",
};

export function AcquisitionWorkspace() {
  const [mode, setMode] = useState<Mode>("url");
  const [urlText, setUrlText] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvFilename, setCsvFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [preview, setPreview] = useState<AcquisitionPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; duplicates: number; failed: number } | null>(null);
  const [manual, setManual] = useState({ name: "", source_type: "manual" as DiscoverySourceType, source_url: "", portfolio_url: "", region: "", software: "", skills: "", public_profile: "", research_status: "new" });

  const forbiddenHeaders = headers.filter((header) => forbiddenCsvColumns.includes(header.toLowerCase()));

  function resetPreview() { setPreview(null); setConfirmed(false); setResult(null); setError(null); }

  async function requestPreview(kind: "url" | "csv", text: string, columnMapping?: ColumnMapping) {
    setPending(true); setError(null); setResult(null);
    try {
      const response = await fetch("/api/acquisition/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, text, mapping: columnMapping }) });
      const body = await response.json() as AcquisitionPreview & { error?: string };
      if (!response.ok) throw new Error(body.error || "プレビューを作成できませんでした。");
      setPreview(body); setConfirmed(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "プレビューを作成できませんでした。"); }
    finally { setPending(false); }
  }

  async function previewManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null);
    try {
      const normalized = normalizeCandidateUrl(manual.source_url);
      const portfolio = manual.portfolio_url ? normalizeCandidateUrl(manual.portfolio_url) : normalized;
      const response = await fetch("/api/acquisition/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "url", text: normalized }) });
      const body = await response.json() as AcquisitionPreview & { error?: string };
      if (!response.ok) throw new Error(body.error || "入力を確認できませんでした。");
      const row = body.rows[0];
      row.sourceType = manual.source_type === "manual" ? identifyAcquisitionSource(normalized) : manual.source_type;
      row.data = {
        name: manual.name, source_type: row.sourceType, source_url: normalized, portfolio_url: portfolio,
        region: manual.region, software: splitAcquisitionList(manual.software), skills: splitAcquisitionList(manual.skills),
        languages: [], employment_types: [], work_location_preferences: [], notes_for_review: "手動簡易登録",
        public_profile: manual.public_profile,
        research_status: manual.research_status as "new" | "reviewing" | "needs_more_info" | "ready_for_ai_review" | "ready_for_approval",
      };
      if (!manual.name.trim()) row.errors.push("公開名がありません。");
      row.supported = row.errors.length === 0;
      setPreview({ ...body, rows: [row], summary: { ...body.summary, supported: row.supported ? 1 : 0, unsupported: row.supported ? 0 : 1, newItems: row.supported && !row.duplicate ? 1 : 0 } });
      setConfirmed(false);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "入力を確認できませんでした。"); }
  }

  async function confirmImport() {
    if (!preview || !confirmed) return;
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/acquisition/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: mode, filename: csvFilename || undefined, columnMapping: mode === "csv" ? mapping : undefined, rows: preview.rows }) });
      const body = await response.json() as { created: number; duplicates: number; failed: number; error?: string };
      if (!response.ok) throw new Error(body.error || "Inboxへ登録できませんでした。");
      setResult(body); setPreview(null); setConfirmed(false);
      if (mode === "url") setUrlText("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Inboxへ登録できませんでした。"); }
    finally { setPending(false); }
  }

  async function readCsv(file: File | undefined) {
    resetPreview();
    if (!file) return;
    if (file.size > 1024 * 1024) { setError("CSVは1MB以下にしてください。"); return; }
    const text = await file.text();
    try {
      const parsed = parseCsv(text);
      const nextHeaders = parsed[0]?.map((value) => value.trim()) ?? [];
      setCsvText(text); setCsvFilename(file.name.slice(0, 255)); setHeaders(nextHeaders); setMapping(defaultColumnMapping(nextHeaders));
    } catch (readError) { setError(readError instanceof Error ? readError.message : "CSVを読み込めませんでした。"); }
  }

  return (
    <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border bg-surface">
        <div className="flex gap-1 overflow-x-auto border-b p-2">
          <ModeButton active={mode === "url"} onClick={() => { setMode("url"); resetPreview(); }} icon={<Link2 size={14} />} label="URL一括" />
          <ModeButton active={mode === "csv"} onClick={() => { setMode("csv"); resetPreview(); }} icon={<FileSpreadsheet size={14} />} label="CSV" />
          <ModeButton active={mode === "manual"} onClick={() => { setMode("manual"); resetPreview(); }} icon={<UserPlus size={14} />} label="手動簡易" />
        </div>

        <div className="p-5 sm:p-6">
          {mode === "url" ? (
            <div>
              <h2 className="text-sm font-medium">URL一括登録</h2>
              <p className="mt-2 text-xs leading-5 text-muted">1行1URL、最大100件。Behance、ArtStation、LinkedIn、CGArchitect、個人／会社サイトを調査キューへ送ります。</p>
              <textarea value={urlText} onChange={(event) => { setUrlText(event.target.value); resetPreview(); }} rows={12} maxLength={210000} placeholder={"https://www.behance.net/...\nhttps://www.artstation.com/...\nhttps://www.linkedin.com/in/..."} className="mt-5 w-full rounded-xl border bg-[#faf9f5] px-4 py-3 font-mono text-xs leading-6 outline-none focus:border-[#77756d]" />
              <Button type="button" className="mt-4" disabled={pending || !urlText.trim()} onClick={() => requestPreview("url", urlText)}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}登録前に確認</Button>
            </div>
          ) : mode === "csv" ? (
            <div>
              <h2 className="text-sm font-medium">CSVインポート</h2>
              <p className="mt-2 text-xs leading-5 text-muted">最大100件。メール、電話、住所列は保存せず、AIにも送りません。</p>
              <label className="mt-5 flex cursor-pointer flex-col items-center rounded-xl border border-dashed bg-[#faf9f5] px-5 py-10 text-center">
                <Upload size={20} className="text-muted" /><span className="mt-3 text-sm">CSVを選択</span><span className="mt-1 text-xs text-muted">UTF-8 / 1MB以下</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void readCsv(event.target.files?.[0])} />
              </label>
              {headers.length ? <div className="mt-5"><div className="flex items-center justify-between"><h3 className="text-xs font-medium">列マッピング</h3><span className="font-mono text-[10px] text-muted">{csvFilename}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{headers.map((header) => {
                const forbidden = forbiddenCsvColumns.includes(header.toLowerCase());
                return <label key={header} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2"><span className="truncate font-mono text-xs">{header}</span><select disabled={forbidden} value={forbidden ? "ignore" : mapping[header] ?? "ignore"} onChange={(event) => { setMapping((current) => ({ ...current, [header]: event.target.value as AcquisitionField | "ignore" })); resetPreview(); }} className="h-8 rounded-md border bg-white px-2 text-xs"><option value="ignore">除外</option>{acquisitionFields.map((field) => <option key={field} value={field}>{fieldLabels[field]}</option>)}</select></label>;
              })}</div>{forbiddenHeaders.length ? <p className="mt-3 text-xs text-[#8b6957]">除外される連絡先列：{forbiddenHeaders.join("、")}</p> : null}<Button type="button" className="mt-4" disabled={pending || !csvText} onClick={() => requestPreview("csv", csvText, mapping)}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}プレビュー</Button></div> : null}
            </div>
          ) : (
            <form onSubmit={previewManual}>
              <h2 className="text-sm font-medium">手動簡易登録</h2>
              <p className="mt-2 text-xs leading-5 text-muted">公開情報だけで仮登録します。正式候補への登録はDiscoveryで別途承認します。</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <TextField label="公開名 *" value={manual.name} onChange={(value) => setManual({ ...manual, name: value })} maxLength={200} />
                <label className="text-xs"><span className="text-muted">ソース種別</span><select value={manual.source_type} onChange={(event) => setManual({ ...manual, source_type: event.target.value as DiscoverySourceType })} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm">{Object.entries(sourceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <TextField label="ソースURL *" value={manual.source_url} onChange={(value) => setManual({ ...manual, source_url: value })} />
                <TextField label="ポートフォリオURL" value={manual.portfolio_url} onChange={(value) => setManual({ ...manual, portfolio_url: value })} />
                <TextField label="地域" value={manual.region} onChange={(value) => setManual({ ...manual, region: value })} maxLength={120} />
                <TextField label="確認状態" value={manual.research_status} onChange={(value) => setManual({ ...manual, research_status: value })} list="research-statuses" />
                <TextField label="使用ソフト（カンマ区切り）" value={manual.software} onChange={(value) => setManual({ ...manual, software: value })} />
                <TextField label="スキル（カンマ区切り）" value={manual.skills} onChange={(value) => setManual({ ...manual, skills: value })} />
              </div>
              <datalist id="research-statuses"><option value="new" /><option value="reviewing" /><option value="needs_more_info" /><option value="ready_for_ai_review" /><option value="ready_for_approval" /></datalist>
              <label className="mt-4 block text-xs"><span className="text-muted">公開プロフィール</span><textarea value={manual.public_profile} onChange={(event) => setManual({ ...manual, public_profile: event.target.value })} maxLength={5000} rows={5} className="mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm" /></label>
              <Button className="mt-4" disabled={pending}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}登録前に確認</Button>
            </form>
          )}
        </div>
      </section>

      <aside className="space-y-5">
        {preview ? <PreviewPanel preview={preview} confirmed={confirmed} setConfirmed={setConfirmed} pending={pending} onConfirm={confirmImport} /> : <section className="rounded-xl border bg-[#f8f7f2] p-5"><h2 className="text-sm font-medium">登録フロー</h2><ol className="mt-4 space-y-3 text-xs leading-5 text-muted"><li>1. URL／CSVを検証</li><li>2. 対応・重複・エラーを人が確認</li><li>3. Discovery Inboxへ仮登録</li><li>4. Research Queueで調査・承認</li></ol><p className="mt-5 border-t pt-4 text-[11px] leading-5 text-muted">LinkedInはURL・手入力・CSVだけを扱い、プロフィールの自動取得は行いません。</p></section>}
        {error ? <p role="alert" className="rounded-xl border border-[#dec4c0] bg-[#f5e9e7] p-4 text-xs text-danger">{error}</p> : null}
        {result ? <section className="rounded-xl border border-[#cfd8cf] bg-[#f3f7f3] p-5"><h2 className="flex items-center gap-2 text-sm font-medium"><Check size={15} />Inboxへ登録しました</h2><p className="mt-3 text-xs text-muted">新規 {result.created}件・重複 {result.duplicates}件・失敗 {result.failed}件</p><Link href="/discovery/research" className="mt-4 inline-block text-xs underline underline-offset-4">Research Queueを開く</Link></section> : null}
      </aside>
    </div>
  );
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return <button type="button" onClick={onClick} className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-xs text-muted", active && "bg-[#e9e7df] text-foreground")}>{icon}{label}</button>;
}

function TextField({ label, value, onChange, maxLength = 2048, list }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; list?: string }) {
  return <label className="text-xs"><span className="text-muted">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} list={list} className="mt-2 h-10 w-full rounded-lg border bg-white px-3 text-sm" /></label>;
}

function PreviewPanel({ preview, confirmed, setConfirmed, pending, onConfirm }: { preview: AcquisitionPreview; confirmed: boolean; setConfirmed: (value: boolean) => void; pending: boolean; onConfirm: () => void }) {
  const summary = preview.summary;
  return <section className="rounded-xl border bg-surface p-5"><h2 className="text-sm font-medium">登録前の確認</h2><div className="mt-4 grid grid-cols-2 gap-2">{[["URL / 行", summary.total], ["対応", summary.supported], ["未対応", summary.unsupported], ["重複", summary.duplicates], ["新規", summary.newItems]].map(([label, value]) => <div key={String(label)} className="rounded-lg border bg-[#faf9f5] p-3"><p className="text-[10px] text-muted">{label}</p><p className="mt-1 font-mono text-xl">{value}</p></div>)}</div><div className="mt-4 max-h-52 space-y-2 overflow-y-auto">{preview.rows.map((row) => <PreviewRow key={row.rowNumber} row={row} />)}</div><div className="mt-5 border-t pt-4"><p className="text-[10px] font-medium tracking-wide text-muted uppercase">取得予定情報</p><p className="mt-2 text-xs leading-5 text-muted">{summary.plannedFields.join("、")}</p>{summary.excludedColumns.length ? <p className="mt-2 text-xs text-[#8b6957]">保存しない列：{summary.excludedColumns.join("、")}</p> : null}</div><label className="mt-5 flex items-start gap-3 rounded-lg border bg-[#faf9f5] p-3 text-xs leading-5"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4 accent-[#252522]" /><span>内容と重複を確認しました。正式候補にはせずDiscovery Inboxへ登録します。</span></label><Button type="button" className="mt-4 w-full" disabled={!confirmed || pending || summary.newItems === 0} onClick={onConfirm}>{pending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}Inboxへ登録</Button></section>;
}

function PreviewRow({ row }: { row: AcquisitionPreviewRow }) {
  const tone = !row.supported ? "text-danger" : row.duplicate ? "text-[#8b6957]" : "text-[#596d5d]";
  return <div className="rounded-lg border px-3 py-2"><div className="flex items-center gap-2"><span className="font-mono text-[10px] text-muted">{row.rowNumber}</span><span className="min-w-0 flex-1 truncate text-xs">{row.data.name || row.rawInput}</span><span className={cn("text-[10px]", tone)}>{!row.supported ? "未対応" : row.duplicate ? "重複" : "新規"}</span></div>{row.errors.length ? <p className="mt-1 flex items-start gap-1 text-[10px] text-danger"><AlertTriangle size={10} className="mt-0.5 shrink-0" />{row.errors.join(" / ")}</p> : null}</div>;
}
