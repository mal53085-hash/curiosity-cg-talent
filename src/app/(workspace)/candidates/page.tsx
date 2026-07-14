import Link from "next/link";
import { Grid2X2, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { CandidateCard } from "@/components/candidate-card";
import { CandidateTable } from "@/components/candidate-table";
import { BulkEnrichment } from "@/components/bulk-enrichment";
import { ButtonLink } from "@/components/ui/button-link";
import { buttonStyles } from "@/components/ui/button";
import { fieldControlClass } from "@/components/ui/field";
import { getCandidates } from "@/lib/candidates/data";
import { getHiringSignals, isCandidateStale } from "@/lib/candidates/japan-hiring";
import { getUiMode } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import {
  candidateRatings,
  candidateStatuses,
  type CandidateRating,
  type CandidateStatus,
} from "@/types/candidate";

const countries = [
  "Japan",
  "China",
  "South Korea",
  "Vietnam",
  "Thailand",
  "Indonesia",
  "Philippines",
  "India",
  "United Kingdom",
  "United States",
] as const;

interface CandidatesPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    rating?: string;
    country?: string;
    readiness?: string;
    japanese?: string;
    min_cg?: string;
    software?: string;
    experience?: string;
    pipeline?: string;
    view_name?: string;
    view?: string;
    focus?: string;
  }>;
}

export default async function CandidatesPage({ searchParams }: CandidatesPageProps) {
  const params = await searchParams;
  const status = candidateStatuses.includes(params.status as CandidateStatus)
    ? (params.status as CandidateStatus)
    : undefined;
  const rating = candidateRatings.includes(params.rating as CandidateRating)
    ? (params.rating as CandidateRating)
    : undefined;
  const view = params.view === "table" ? "table" : "gallery";
  const uiMode = await getUiMode();
  let candidates = await getCandidates({
    query: params.q,
    status,
    rating,
    country: params.country || undefined,
    readiness: params.readiness || undefined,
    japaneseLevel: params.japanese || undefined,
    minimumCgFit: params.min_cg ? Number(params.min_cg) : undefined,
    software: params.software || undefined,
    experience: ["junior", "mid", "senior"].includes(params.experience ?? "") ? params.experience as "junior" | "mid" | "senior" : undefined,
    pipeline: params.pipeline || undefined,
  });
  if (params.view_name === "tokyo") candidates = candidates.filter((candidate) => candidate.willing_to_work_in_tokyo || candidate.work_location_preferences.some((value) => /tokyo/i.test(value)));
  if (params.view_name === "relocation") candidates = candidates.filter((candidate) => candidate.willing_to_relocate_to_japan || candidate.interested_in_japan);
  if (params.view_name === "remote") candidates = candidates.filter((candidate) => candidate.remote_from_overseas || candidate.hiring_readiness_status === "C");
  if (params.view_name === "contact_week") candidates = candidates.filter((candidate) => getHiringSignals(candidate).contactPriority >= 55 && candidate.hiring_pipeline_stage !== "closed");
  if (params.view_name === "stale") candidates = candidates.filter((candidate) => isCandidateStale(candidate));

  const hasFilters = Boolean(params.q || status || rating || params.country || params.readiness || params.japanese || params.min_cg || params.software || params.experience || params.pipeline || params.view_name);
  const viewHref = (nextView: "gallery" | "table") => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (status) query.set("status", status);
    if (rating) query.set("rating", rating);
    if (params.country) query.set("country", params.country);
    for (const key of ["readiness", "japanese", "min_cg", "software", "experience", "pipeline", "view_name"] as const) if (params[key]) query.set(key, params[key]!);
    query.set("view", nextView);
    return `/candidates?${query.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">
            Talent pool
          </p>
          <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">候補者</h1>
          <p className="mt-2 text-sm text-muted">CG品質、日本勤務条件、連絡優先度で候補を確認します。</p>
        </div>
        <ButtonLink href="/candidates/new" className="w-full sm:w-auto">
          <Plus size={16} />
          候補者を追加
        </ButtonLink>
      </header>

      <nav className="mt-7 flex gap-2 overflow-x-auto pb-1" aria-label="保存済みビュー">{[["日本在住","?country=Japan"],["東京勤務候補","?view_name=tokyo"],["日本移住候補","?view_name=relocation"],["海外リモート","?view_name=remote"],["条件未確認","?readiness=D"],["今週連絡する候補","?view_name=contact_week"]].map(([label, href]) => <Link key={label} href={`/candidates${href}`} className="shrink-0 rounded-full border bg-surface px-3 py-2 text-xs text-muted hover:text-foreground">{label}</Link>)}</nav>

      <form className="mt-4 rounded-xl border bg-surface p-3" action="/candidates" method="get">
        <input type="hidden" name="view" value={view} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="candidate-search"
              name="q"
              defaultValue={params.q}
              autoFocus={params.focus === "search"}
              placeholder="氏名、専門領域、地域で検索"
              className={cn(fieldControlClass, "pl-9")}
              aria-label="候補者を検索"
            />
          </div>
          <select name="readiness" defaultValue={params.readiness ?? ""} className={fieldControlClass} aria-label="Japan Readiness"><option value="">Japan Readiness</option>{["A","B","C","D","blocked"].map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select name="country" defaultValue={params.country ?? ""} className={fieldControlClass} aria-label="国・地域">
            <option value="">すべての国・地域</option>
            {countries.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
          <select name="japanese" defaultValue={params.japanese ?? ""} className={fieldControlClass} aria-label="日本語レベル"><option value="">日本語レベル</option>{["Native","N1","N2","N3","Basic","None"].map((value) => <option key={value}>{value}</option>)}</select>
          <select name="min_cg" defaultValue={params.min_cg ?? ""} className={fieldControlClass} aria-label="CG Fit"><option value="">CG Fit</option><option value="80">80以上</option><option value="70">70以上</option><option value="60">60以上</option></select>
          <select name="software" defaultValue={params.software ?? ""} className={fieldControlClass} aria-label="使用ソフト"><option value="">使用ソフト</option><option>3ds Max</option><option>Corona Renderer</option><option>V-Ray</option></select>
          <select name="experience" defaultValue={params.experience ?? ""} className={fieldControlClass} aria-label="経験レベル"><option value="">経験レベル</option><option value="junior">Junior · 0–3年</option><option value="mid">Mid · 4–7年</option><option value="senior">Senior · 8年以上</option></select>
          <select name="pipeline" defaultValue={params.pipeline ?? ""} className={fieldControlClass} aria-label="採用ステータス"><option value="">採用ステータス</option>{[["new","New"],["shortlist","Shortlist"],["contacted","Contacted"],["interview","Interview"],["offer","Offer"],["closed","Closed"]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          <button type="submit" className={buttonStyles("secondary", "px-5")}>
            <SlidersHorizontal size={15} />
            絞り込む
          </button>
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted"><span className="font-mono text-foreground">{candidates.length}</span> 件</p>
          {hasFilters ? (
            <Link href="/candidates" className="flex items-center gap-1 text-xs text-muted hover:text-foreground">
              <X size={12} /> フィルターを解除
            </Link>
          ) : null}
        </div>
        <div className="flex rounded-lg border bg-surface p-1" aria-label="表示切り替え">
          <Link
            href={viewHref("gallery")}
            aria-label="ギャラリー表示"
            className={cn(
              "grid size-8 place-items-center rounded-md text-muted transition",
              view === "gallery" && "bg-surface-muted text-foreground",
            )}
          >
            <Grid2X2 size={14} />
          </Link>
          <Link
            href={viewHref("table")}
            aria-label="テーブル表示"
            className={cn(
              "grid size-8 place-items-center rounded-md text-muted transition",
              view === "table" && "bg-surface-muted text-foreground",
            )}
          >
            <List size={15} />
          </Link>
        </div>
      </div>

      {uiMode === "advanced" ? <BulkEnrichment kind="candidates" records={candidates.map((candidate) => ({ id: candidate.id, name: `${candidate.full_name} — ${candidate.data_quality_score}/100` }))} /> : null}

      {candidates.length > 0 ? (
        view === "gallery" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {candidates.map((candidate) => (
              <CandidateCard key={candidate.id} candidate={candidate} />
            ))}
          </div>
        ) : (
          <div className="mt-4"><CandidateTable candidates={candidates} /></div>
        )
      ) : (
        <section className="mt-4 rounded-xl border bg-surface px-6 py-20 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
            <Search size={18} />
          </div>
          <h2 className="mt-5 text-base font-medium">該当する候補者が見つかりません</h2>
          <p className="mt-2 text-sm text-muted">検索条件を変更するか、新しい候補者を追加してください。</p>
          <ButtonLink href="/candidates/new" variant="secondary" className="mt-6">
            <Plus size={15} /> 候補者を追加
          </ButtonLink>
        </section>
      )}
    </div>
  );
}
