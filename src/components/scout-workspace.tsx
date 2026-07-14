"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clipboard, GitCompareArrows, RotateCcw, Search, Sparkles } from "lucide-react";
import { buttonStyles } from "@/components/ui/button";
import { fieldControlClass } from "@/components/ui/field";
import type { OutreachDraft, SavedScoutSearch, ScoutFilters, ScoutResultView } from "@/types/scout";

type ScoutRunSummary = {
  id: string;
  original_query: string;
  status: string;
  candidate_pool_count: number;
  ranked_count: number;
  started_at: string;
};

type SearchResponse = { run_id: string; filters: ScoutFilters; results: ScoutResultView[]; error?: string };

const examples = [
  "TASAKIの高級店舗案件に向く人",
  "3ds MaxとCoronaを使える日本勤務可能な人",
  "ホテル内装の夜景表現が得意な人",
  "構図と人工照明が強い人",
  "年収700万円前後で東京勤務可能性がある候補",
];

const axisLabels: Record<string, string> = {
  composition: "構図",
  lighting: "ライティング",
  materials: "マテリアル",
  luxury_brand_fit: "高級ブランド適性",
  interior_understanding: "インテリア理解",
  detail: "ディテール",
  finish: "仕上げ",
  technical_adaptability: "技術適応力",
};

const comparisonRows: Array<[string, (item: ScoutResultView) => string | number]> = [
  ["AI作品総合点", (item) => item.candidate.ai_score ?? "—"],
  ["Scout適合点", (item) => item.scout_score],
  ["ソフト / スキル", (item) => item.candidate.skills.slice(0, 6).join(", ") || "—"],
  ["ブランド案件適性", (item) => item.comparison.brand_fit],
  ["ホテル・店舗適性", (item) => item.comparison.hospitality_fit],
  ["日本勤務適性", (item) => item.comparison.japan_work_fit],
  ["リスク", (item) => item.comparison.risk_level],
  ["推奨順位", (item) => `#${item.rank}`],
  ...Object.entries(axisLabels).map(([key, label]) => [label, (item: ScoutResultView) => item.candidate.ai_scores[key] ?? "—"] as [string, (item: ScoutResultView) => string | number]),
];

function Metric({ label, value }: { label: string; value: number | null | undefined }) {
  return <div><p className="text-[10px] tracking-[0.12em] text-muted uppercase">{label}</p><p className="mt-1 font-mono text-xl">{value ?? "—"}<span className="text-xs text-muted">{value == null ? "" : "/100"}</span></p></div>;
}

export function ScoutWorkspace({ initialSearches, initialRuns }: { initialSearches: SavedScoutSearch[]; initialRuns: ScoutRunSummary[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [saveName, setSaveName] = useState("");
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [response, setResponse] = useState<SearchResponse>();
  const [selected, setSelected] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, OutreachDraft>>({});
  const [draftLoading, setDraftLoading] = useState<string>();
  const [copied, setCopied] = useState<string>();

  const selectedResults = useMemo(() => response?.results.filter((item) => selected.includes(item.candidate_id)) ?? [], [response, selected]);
  async function runSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(undefined); setSelected([]); setResponse(undefined);
    try {
      const apiResponse = await fetch("/api/scout/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, save_name: activeSearchId ? null : saveName.trim() || null, search_id: activeSearchId }),
      });
      const data = await apiResponse.json() as SearchResponse;
      if (!apiResponse.ok) throw new Error(data.error || "検索できませんでした。");
      setResponse(data);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "検索できませんでした。");
    } finally { setLoading(false); }
  }

  function toggleCandidate(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  async function generateDraft(candidateId: string) {
    if (!response) return;
    setDraftLoading(candidateId); setError(undefined);
    try {
      const apiResponse = await fetch("/api/scout/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: response.run_id, candidate_id: candidateId }),
      });
      const data = await apiResponse.json() as { draft?: OutreachDraft; error?: string };
      if (!apiResponse.ok || !data.draft) throw new Error(data.error || "文面を生成できませんでした。");
      setDrafts((current) => ({ ...current, [candidateId]: data.draft! }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文面を生成できませんでした。");
    } finally { setDraftLoading(undefined); }
  }

  async function copyText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(undefined), 1800);
    } catch {
      setError("クリップボードへコピーできませんでした。ブラウザの権限を確認してください。");
    }
  }

  return <>
    <header className="flex flex-col gap-5 border-b pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">Talent intelligence</p><h1 className="mt-2 text-3xl font-medium tracking-[-0.05em] sm:text-4xl">AI Scout</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted">案件要件を自然言語で入力すると、登録済み候補だけを絞り込み、適合理由と比較材料を提示します。</p></div>
      <div className="rounded-xl border bg-surface px-4 py-3 text-xs leading-5 text-muted"><span className="font-medium text-foreground">Human decision only.</span><br />AI Scoutは判断材料であり、自動不採用は行いません。</div>
    </header>

    <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        <form onSubmit={runSearch} className="rounded-2xl border bg-surface p-5 shadow-[0_14px_45px_rgba(35,34,30,0.04)] sm:p-7">
          <label htmlFor="scout-query" className="text-sm font-medium">どんな人を探していますか？</label>
          <textarea id="scout-query" value={query} onChange={(event) => { setQuery(event.target.value); setActiveSearchId(null); }} required minLength={5} maxLength={1200} rows={5} placeholder="例：ラグジュアリーホテルの夜景内装に強く、Coronaを使える人" className={`${fieldControlClass} mt-3 resize-y text-base leading-7`} />
          <div className="mt-4 flex flex-wrap gap-2">{examples.map((example) => <button key={example} type="button" onClick={() => { setQuery(example); setActiveSearchId(null); }} className="rounded-full border bg-[#faf9f5] px-3 py-1.5 text-[11px] text-muted transition hover:border-[#aaa89f] hover:text-foreground">{example}</button>)}</div>
          <div className="mt-5 grid gap-4 border-t pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="text-xs text-muted">検索名（任意）<input value={saveName} disabled={Boolean(activeSearchId)} onChange={(event) => setSaveName(event.target.value)} maxLength={120} placeholder={activeSearchId ? "保存済み検索を更新します" : "例：TASAKI retail shortlist"} className={`${fieldControlClass} mt-2`} /></label>
            <button type="submit" disabled={loading || query.trim().length < 5} className={buttonStyles("primary", "h-11 px-6")}><Search size={15} />{loading ? "条件を解析・検索中…" : "候補者を探す"}</button>
          </div>
        </form>

        {error ? <div role="alert" className="rounded-xl border border-[#dec4c0] bg-[#f5e9e7] px-4 py-3 text-sm text-danger">{error}</div> : null}
        {response ? <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] tracking-[0.16em] text-muted uppercase">Scout results</p><h2 className="mt-1 text-2xl font-medium">{response.results.length}人をランキング</h2></div><p className="text-xs text-muted">DB候補を絞り込み、上位候補だけをAIで再評価</p></div>
          <div className="mt-4 flex flex-wrap gap-2">{[...response.filters.required_skills, ...response.filters.regions, ...response.filters.languages].map((item) => <span key={item} className="rounded-full border bg-surface px-3 py-1 text-[11px]">{item}</span>)}{response.filters.minimum_score !== null ? <span className="rounded-full border bg-surface px-3 py-1 text-[11px]">AI {response.filters.minimum_score}+</span> : null}</div>
          {response.filters.warnings.length ? <div className="mt-4 rounded-xl border bg-[#f8f6ef] px-4 py-3 text-xs leading-5 text-muted">{response.filters.warnings.join(" / ")}</div> : null}
          {response.results.length ? <div className="mt-5 space-y-4">{response.results.map((result) => {
            const draft = drafts[result.candidate_id];
            return <article key={result.candidate_id} className="overflow-hidden rounded-2xl border bg-surface shadow-[0_10px_35px_rgba(35,34,30,0.035)]">
              <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[72px_minmax(0,1fr)_180px]">
                <div><div className="grid size-12 place-items-center rounded-full bg-[#252522] font-mono text-sm text-white">#{result.rank}</div><label className="mt-4 flex items-center gap-2 text-[11px] text-muted"><input type="checkbox" checked={selected.includes(result.candidate_id)} disabled={!selected.includes(result.candidate_id) && selected.length >= 3} onChange={() => toggleCandidate(result.candidate_id)} className="size-4 accent-[#252522]" />比較</label></div>
                <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-3"><h3 className="text-xl font-medium tracking-[-0.03em]">{result.candidate.full_name}</h3><span className="text-xs text-muted">{result.candidate.primary_role} · {result.candidate.country}</span></div><p className="mt-4 text-sm leading-7 text-[#55544e]">{result.fit_reason}</p><div className="mt-4 flex flex-wrap gap-1.5">{result.candidate.skills.slice(0, 7).map((skill) => <span key={skill} className="rounded-md border px-2 py-1 text-[10px] text-muted">{skill}</span>)}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-medium">強み</p><ul className="mt-2 space-y-1 text-xs leading-5 text-muted">{result.strengths.map((item) => <li key={item}>— {item}</li>)}</ul></div><div><p className="text-xs font-medium">懸念・確認事項</p><ul className="mt-2 space-y-1 text-xs leading-5 text-muted">{result.concerns.length ? result.concerns.map((item) => <li key={item}>— {item}</li>) : <li>— 明示的な懸念なし。面談で事実確認が必要です。</li>}</ul></div></div><p className="mt-4 rounded-lg bg-[#f5f4ef] px-3 py-2 text-xs"><span className="text-muted">推奨案件:</span> {result.recommended_project}</p></div>
                <div className="rounded-xl border bg-[#faf9f5] p-4"><div className="grid grid-cols-2 gap-4 lg:grid-cols-1"><Metric label="Scout適合点" value={result.scout_score} /><Metric label="AI作品総合点" value={result.candidate.ai_score} /></div><div className="mt-5 space-y-2"><Link href={`/candidates/${result.candidate_id}`} className={buttonStyles("secondary", "w-full text-xs")}>候補者詳細 <ArrowRight size={13} /></Link><button type="button" onClick={() => generateDraft(result.candidate_id)} disabled={draftLoading === result.candidate_id} className={buttonStyles("ghost", "w-full text-xs")}><Sparkles size={13} />{draftLoading === result.candidate_id ? "生成中…" : draft ? "文面を再表示" : "スカウト文面"}</button></div></div>
              </div>
              {draft ? <div className="border-t bg-[#fbfaf7] p-5 sm:p-6"><div className="flex items-center justify-between"><h4 className="text-sm font-medium">スカウト文面（コピー専用・未送信）</h4><span className="text-[10px] text-muted">未確認情報は断定しません</span></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{([["日本語 / LinkedIn", draft.ja.linkedin_short], ["日本語 / メール", draft.ja.email_long], ["English / LinkedIn", draft.en.linkedin_short], ["English / Email", draft.en.email_long]] as const).map(([label, text]) => { const key = `${result.candidate_id}-${label}`; return <div key={label} className="rounded-xl border bg-surface p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-medium">{label}</p><button type="button" onClick={() => copyText(key, text)} className="flex items-center gap-1 text-[10px] text-muted hover:text-foreground">{copied === key ? <Check size={12} /> : <Clipboard size={12} />}{copied === key ? "コピー済み" : "コピー"}</button></div><p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-muted">{text}</p></div>; })}</div></div> : null}
            </article>;
          })}</div> : <div className="mt-5 rounded-2xl border bg-surface px-6 py-20 text-center"><Search className="mx-auto text-muted" size={24} /><h3 className="mt-4 font-medium">条件に合う候補者がまだいません</h3><p className="mt-2 text-sm text-muted">必須条件を減らすか、候補者の公開プロフィール・スキルを追加してください。</p></div>}
        </section> : <section className="rounded-2xl border border-dashed px-6 py-16 text-center"><Sparkles className="mx-auto text-muted" size={24} /><h2 className="mt-4 font-medium">案件要件から最適な候補を探します</h2><p className="mt-2 text-sm text-muted">検索対象は現在Supabaseに登録されている候補者だけです。</p></section>}

        {selectedResults.length ? <section className="rounded-2xl border bg-surface p-5 sm:p-7"><div className="flex items-center gap-3"><GitCompareArrows size={18} /><div><h2 className="font-medium">候補者比較</h2><p className="text-xs text-muted">最大3人。最終判断ではなく面談設計のための比較です。</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-xs"><thead><tr><th className="border-b p-3 text-left text-muted">比較項目</th>{selectedResults.map((item) => <th key={item.candidate_id} className="border-b p-3 text-left text-sm">#{item.rank} {item.candidate.full_name}</th>)}</tr></thead><tbody>{comparisonRows.map(([label, getter]) => <tr key={label}><th className="border-b p-3 text-left font-normal text-muted">{label}</th>{selectedResults.map((item) => <td key={item.candidate_id} className="border-b p-3 align-top">{getter(item)}</td>)}</tr>)}</tbody></table></div></section> : null}
      </div>

      <aside className="space-y-5">
        <section className="rounded-2xl border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">保存済み検索</h2><span className="font-mono text-xs text-muted">{initialSearches.length}</span></div><div className="mt-4 space-y-2">{initialSearches.length ? initialSearches.map((search) => <button key={search.id} type="button" onClick={() => { setQuery(search.original_query); setActiveSearchId(search.id); setSaveName(search.name); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="w-full rounded-xl border p-3 text-left transition hover:bg-[#faf9f5]"><p className="text-xs font-medium">{search.name}</p><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted">{search.original_query}</p><p className="mt-2 font-mono text-[9px] text-muted">最終実行 {search.last_run_at ? new Date(search.last_run_at).toLocaleString("ja-JP") : "未実行"}</p></button>) : <p className="py-6 text-center text-xs text-muted">検索名を付けて実行すると保存されます。</p>}</div>{activeSearchId ? <button type="button" onClick={() => { setActiveSearchId(null); setSaveName(""); }} className="mt-3 flex items-center gap-1 text-[11px] text-muted"><RotateCcw size={12} />新しい検索として保存</button> : null}</section>
        <section className="rounded-2xl border bg-surface p-5"><h2 className="text-sm font-medium">最近の実行</h2><div className="mt-4 space-y-3">{initialRuns.length ? initialRuns.slice(0, 6).map((run) => <div key={run.id} className="border-b pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between"><span className="rounded-full bg-surface-muted px-2 py-1 text-[9px]">{run.status}</span><span className="font-mono text-[9px] text-muted">{new Date(run.started_at).toLocaleString("ja-JP")}</span></div><p className="mt-2 line-clamp-2 text-[11px] leading-5">{run.original_query}</p><p className="mt-1 text-[10px] text-muted">候補 {run.candidate_pool_count} · 結果 {run.ranked_count}</p></div>) : <p className="py-6 text-center text-xs text-muted">実行履歴はまだありません。</p>}</div></section>
      </aside>
    </div>
  </>;
}
