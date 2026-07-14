import { AcquisitionWorkspace } from "@/components/acquisition-workspace";

export default function AddCandidatesPage() {
  return <div className="mx-auto max-w-[1380px] px-4 py-7 sm:px-7 sm:py-10 xl:px-10"><header className="max-w-2xl"><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Add candidates</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">候補者を追加</h1><p className="mt-2 text-sm text-muted">URL、CSV、手入力のいずれかから開始してください。</p></header><AcquisitionWorkspace simple /></div>;
}
