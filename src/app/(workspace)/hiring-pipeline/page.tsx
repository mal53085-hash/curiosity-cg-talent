import Link from "next/link";
import { updatePipelineAction } from "@/app/actions/hiring";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { getCandidates } from "@/lib/candidates/data";
import { getHiringSignals } from "@/lib/candidates/japan-hiring";
import {
  hiringClosedReasonLabels,
  hiringClosedReasons,
  hiringPipelineLabels,
  hiringPipelineStages,
} from "@/types/candidate";

export default async function HiringPipelinePage() {
  const candidates = await getCandidates();
  return (
    <div className="mx-auto max-w-[1700px] px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
      <header>
        <p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">
          Hiring pipeline
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">
          選考を進める
        </h1>
        <p className="mt-2 text-sm text-muted">
          候補者カードのステータスを選ぶだけで更新できます。AIによる自動見送りは行いません。
        </p>
      </header>
      <div className="mt-8 flex gap-4 overflow-x-auto pb-5">
        {hiringPipelineStages.map((stage) => {
          const rows = candidates.filter(
            (candidate) => candidate.hiring_pipeline_stage === stage,
          );
          return (
            <section id={stage} key={stage} className="w-[290px] shrink-0">
              <div className="flex items-center justify-between border-b pb-3">
                <h2 className="text-sm font-medium">
                  {hiringPipelineLabels[stage]}
                </h2>
                <span className="font-mono text-xs text-muted">
                  {rows.length}
                </span>
              </div>
              <div className="mt-3 space-y-3">
                {rows.map((candidate) => {
                  const signals = getHiringSignals(candidate);
                  return (
                    <article
                      key={candidate.id}
                      className="rounded-xl border bg-surface p-4"
                    >
                      <div className="flex gap-3">
                        <CandidateAvatar
                          name={candidate.full_name}
                          imageUrl={candidate.image_url}
                          className="size-10 shrink-0"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/candidates/${candidate.id}`}
                            className="block truncate text-sm font-medium hover:underline"
                          >
                            {candidate.full_name}
                          </Link>
                          <p className="mt-1 truncate text-[10px] text-muted">
                            CG {signals.cgFit ?? "—"} · Japan{" "}
                            {signals.japanReadiness} · Priority{" "}
                            {signals.contactPriority}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted">
                        {signals.nextAction}
                      </p>
                      <form
                        action={updatePipelineAction}
                        className="mt-3 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="candidate_id"
                          value={candidate.id}
                        />
                        <select
                          name="stage"
                          defaultValue={stage}
                          aria-label={`${candidate.full_name}のステータス`}
                          className="h-9 w-full rounded-lg border bg-white px-2 text-xs"
                        >
                          {hiringPipelineStages.map((value) => (
                            <option key={value} value={value}>
                              {hiringPipelineLabels[value]}
                            </option>
                          ))}
                        </select>
                        <select
                          name="closed_reason"
                          defaultValue={candidate.hiring_closed_reason ?? "future_candidate"}
                          aria-label="Closedの理由"
                          className="h-9 w-full rounded-lg border bg-white px-2 text-xs"
                        >
                          <option value="future_candidate">Closedの場合のみ理由を選択</option>
                          {hiringClosedReasons.filter((reason) => reason !== "future_candidate").map((reason) => (
                            <option key={reason} value={reason}>{hiringClosedReasonLabels[reason]}</option>
                          ))}
                        </select>
                        <button className="h-9 w-full rounded-lg border bg-[#f6f5f0] text-xs hover:bg-[#eceae2]">
                          変更を保存
                        </button>
                      </form>
                    </article>
                  );
                })}
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted">
                    候補者はいません
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
