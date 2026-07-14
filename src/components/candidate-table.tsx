import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { StatusBadge } from "@/components/status-badge";
import type { Candidate } from "@/types/candidate";

interface CandidateTableProps {
  candidates: Candidate[];
}

export function CandidateTable({ candidates }: CandidateTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-surface">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead>
            <tr className="border-b bg-[#faf9f5] text-[10px] font-medium tracking-[0.12em] text-muted uppercase">
              <th className="px-5 py-3.5">候補者</th>
              <th className="px-4 py-3.5">地域</th>
              <th className="px-4 py-3.5">評価</th>
              <th className="px-4 py-3.5">AIスコア</th>
              <th className="px-4 py-3.5">ステータス</th>
              <th className="w-12 px-4 py-3.5"><span className="sr-only">詳細</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {candidates.map((candidate) => (
              <tr key={candidate.id} className="group transition hover:bg-[#faf9f5]">
                <td className="px-5 py-4">
                  <Link href={`/candidates/${candidate.id}`} className="flex items-center gap-3">
                    <CandidateAvatar
                      name={candidate.full_name}
                      imageUrl={candidate.image_url}
                      className="size-10 rounded-lg"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{candidate.full_name}</span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {candidate.primary_role}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-xs text-muted">
                  {[candidate.city, candidate.country].filter(Boolean).join(", ")}
                </td>
                <td className="px-4 py-4 font-mono text-sm font-medium">
                  {candidate.rating === "unrated" ? "—" : candidate.rating}
                </td>
                <td className="px-4 py-4 font-mono text-xs text-muted">
                  {candidate.ai_score ?? "—"}
                </td>
                <td className="px-4 py-4"><StatusBadge status={candidate.status} /></td>
                <td className="px-4 py-4">
                  <Link
                    href={`/candidates/${candidate.id}`}
                    aria-label={`${candidate.full_name}の詳細を見る`}
                    className="grid size-8 place-items-center rounded-lg text-muted transition group-hover:bg-surface-muted group-hover:text-foreground"
                  >
                    <ChevronRight size={15} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y md:hidden">
        {candidates.map((candidate) => (
          <Link
            key={candidate.id}
            href={`/candidates/${candidate.id}`}
            className="flex items-center gap-3 p-4 transition hover:bg-[#faf9f5]"
          >
            <CandidateAvatar
              name={candidate.full_name}
              imageUrl={candidate.image_url}
              className="size-12 rounded-lg"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{candidate.full_name}</span>
              <span className="mt-1 block truncate text-xs text-muted">
                {candidate.primary_role} · {candidate.country}
              </span>
              <span className="mt-2 block"><StatusBadge status={candidate.status} /></span>
            </span>
            <span className="font-mono text-sm font-medium">
              {candidate.rating === "unrated" ? "—" : candidate.rating}
            </span>
            <ChevronRight size={15} className="text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
