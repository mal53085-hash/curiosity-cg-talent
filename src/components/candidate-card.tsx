import Link from "next/link";
import { ArrowUpRight, MapPin } from "lucide-react";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { getHiringSignals } from "@/lib/candidates/japan-hiring";
import { hiringPipelineLabels, type Candidate } from "@/types/candidate";

interface CandidateCardProps {
  candidate: Candidate;
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  const signals = getHiringSignals(candidate);
  return (
    <Link
      href={`/candidates/${candidate.id}`}
      className="group overflow-hidden rounded-xl border bg-surface transition duration-200 hover:-translate-y-0.5 hover:border-[#c9c7bf] hover:shadow-[0_12px_36px_rgba(31,31,29,.07)]"
    >
      <CandidateAvatar
        name={candidate.full_name}
        imageUrl={candidate.image_url}
        className="aspect-[4/3] w-full rounded-none text-3xl"
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-medium tracking-[-0.02em]">
              {candidate.full_name}
            </h2>
            <p className="mt-1 truncate text-xs text-muted">{candidate.primary_role}</p>
          </div>
          <ArrowUpRight
            size={16}
            className="shrink-0 text-[#aaa89f] transition group-hover:text-foreground"
          />
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-muted">
            <MapPin size={12} />
            {[candidate.city, candidate.country].filter(Boolean).join(", ")}
          </span>
          <span className="text-[10px] text-muted">{hiringPipelineLabels[candidate.hiring_pipeline_stage]}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-4 text-center"><Metric label="CG Fit" value={signals.cgFit}/><Metric label="Japan" value={signals.japanReadiness}/><Metric label="Priority" value={signals.contactPriority}/></div>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number | string | null }) { return <span><span className="block text-[9px] text-muted">{label}</span><span className="mt-1 block font-mono text-sm">{value ?? "—"}</span></span>; }
