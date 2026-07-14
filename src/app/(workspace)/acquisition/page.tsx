import { AcquisitionWorkspace } from "@/components/acquisition-workspace";

export default function AcquisitionPage() {
  return (
    <div className="mx-auto max-w-[1480px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10">
      <header>
        <p className="text-[10px] font-medium tracking-[0.18em] text-muted uppercase">Candidate acquisition</p>
        <h1 className="mt-2 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">Acquisition</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">公開情報を安全に整理し、正式候補にはせずDiscovery Inboxへ送ります。自動スクレイピングや自動承認は行いません。</p>
      </header>
      <AcquisitionWorkspace />
    </div>
  );
}
