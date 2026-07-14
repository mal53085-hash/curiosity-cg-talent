import Link from "next/link";
import { DiscoveryAiButton } from "@/components/discovery-ai-button";
import { CandidatePortfolioManager } from "@/components/candidate-portfolio-manager";
import { getResearchItem } from "@/lib/discovery/data";
import { researchStatusLabels, sourceTypeLabels } from "@/types/discovery";

export default async function ResearchItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { item, images, eligibility } = await getResearchItem(id);
  return <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><Link href="/discovery/research" className="text-xs text-muted hover:text-foreground">← Research Queue</Link><header className="mt-5 rounded-xl border bg-surface p-5 sm:p-7"><div className="flex flex-wrap gap-2"><span className="rounded-full bg-surface-muted px-2 py-1 text-[10px]">{sourceTypeLabels[item.source_type]}</span><span className="rounded-full border px-2 py-1 text-[10px]">{researchStatusLabels[item.research_status]}</span><span className="ml-auto font-mono text-xs">DQ {item.research_quality_score}</span></div><h1 className="mt-4 text-3xl font-medium tracking-[-.045em]">{item.author_name}</h1><p className="mt-2 text-sm text-muted">{item.title}</p><div className="mt-5 flex flex-wrap items-center gap-3"><a href={item.portfolio_url || item.source_url} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-xs">公開ページを確認</a><DiscoveryAiButton id={item.id} disabled={!eligibility.eligible} /></div>{!eligibility.eligible ? <p className="mt-3 text-xs text-muted">{eligibility.reasons.join(" / ")}</p> : null}</header><div className="mt-6"><CandidatePortfolioManager resourceId={item.id} resourceType="discovery" images={images} eligibility={eligibility} /></div></div>;
}
