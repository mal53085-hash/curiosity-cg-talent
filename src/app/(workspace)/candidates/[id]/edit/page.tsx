import { ChevronLeft } from "lucide-react";
import { updateCandidateAction } from "@/app/actions/candidates";
import { CandidateForm } from "@/components/candidate-form";
import { ButtonLink } from "@/components/ui/button-link";
import { getCandidate } from "@/lib/candidates/data";

interface EditCandidatePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCandidatePage({ params }: EditCandidatePageProps) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  const action = updateCandidateAction.bind(null, candidate.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <ButtonLink href={`/candidates/${candidate.id}`} variant="ghost" className="-ml-3 h-9 px-3">
        <ChevronLeft size={15} /> 候補者詳細
      </ButtonLink>
      <header className="mb-8 mt-4">
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">Edit talent</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">候補者を編集</h1>
        <p className="mt-2 text-sm text-muted">{candidate.full_name} の情報を更新します。</p>
      </header>
      <CandidateForm action={action} candidate={candidate} />
    </div>
  );
}
