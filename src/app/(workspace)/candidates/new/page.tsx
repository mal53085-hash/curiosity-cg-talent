import { ChevronLeft } from "lucide-react";
import { createCandidateAction } from "@/app/actions/candidates";
import { CandidateForm } from "@/components/candidate-form";
import { ButtonLink } from "@/components/ui/button-link";

export default function NewCandidatePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <ButtonLink href="/candidates" variant="ghost" className="-ml-3 h-9 px-3">
        <ChevronLeft size={15} /> 候補者一覧
      </ButtonLink>
      <header className="mb-8 mt-4">
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">New talent</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">候補者を追加</h1>
        <p className="mt-2 text-sm text-muted">発見したCG人材のプロフィールを登録します。</p>
      </header>
      <CandidateForm action={createCandidateAction} />
    </div>
  );
}
