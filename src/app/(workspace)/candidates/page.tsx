import Link from "next/link";
import { Grid2X2, List, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { CandidateCard } from "@/components/candidate-card";
import { CandidateTable } from "@/components/candidate-table";
import { BulkEnrichment } from "@/components/bulk-enrichment";
import { ButtonLink } from "@/components/ui/button-link";
import { buttonStyles } from "@/components/ui/button";
import { fieldControlClass } from "@/components/ui/field";
import { getCandidates } from "@/lib/candidates/data";
import { cn } from "@/lib/utils";
import {
  candidateRatings,
  candidateStatuses,
  ratingLabels,
  statusLabels,
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
  const candidates = await getCandidates({
    query: params.q,
    status,
    rating,
    country: params.country || undefined,
  });

  const hasFilters = Boolean(params.q || status || rating || params.country);
  const viewHref = (nextView: "gallery" | "table") => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (status) query.set("status", status);
    if (rating) query.set("rating", rating);
    if (params.country) query.set("country", params.country);
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
          <p className="mt-2 text-sm text-muted">発掘したCG人材を比較・評価・管理します。</p>
        </div>
        <ButtonLink href="/candidates/new" className="w-full sm:w-auto">
          <Plus size={16} />
          候補者を追加
        </ButtonLink>
      </header>

      <form className="mt-8 rounded-xl border bg-surface p-3" action="/candidates" method="get">
        <input type="hidden" name="view" value={view} />
        <div className="grid gap-2 lg:grid-cols-[minmax(240px,1fr)_180px_140px_180px_auto]">
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
          <select name="status" defaultValue={status ?? ""} className={fieldControlClass} aria-label="ステータス">
            <option value="">全ステータス</option>
            {candidateStatuses.map((item) => (
              <option key={item} value={item}>{statusLabels[item]}</option>
            ))}
          </select>
          <select name="rating" defaultValue={rating ?? ""} className={fieldControlClass} aria-label="評価">
            <option value="">全評価</option>
            {candidateRatings.map((item) => (
              <option key={item} value={item}>{ratingLabels[item]}</option>
            ))}
          </select>
          <select name="country" defaultValue={params.country ?? ""} className={fieldControlClass} aria-label="国・地域">
            <option value="">すべての国・地域</option>
            {countries.map((country) => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>
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

      <BulkEnrichment kind="candidates" records={candidates.map((candidate) => ({ id: candidate.id, name: `${candidate.full_name} — ${candidate.data_quality_score}/100` }))} />

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
