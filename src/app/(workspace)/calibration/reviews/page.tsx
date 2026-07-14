import Link from "next/link";
import { ReviewSampling } from "@/components/review-sampling";
import { getCalibrationSamples } from "@/lib/calibration/data";

export default async function CalibrationReviewsPage() {
  const { samples, rubric } = await getCalibrationSamples();
  return <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><Link href="/calibration" className="text-xs text-muted hover:text-foreground">← 評価基準へ</Link><header className="mt-5"><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Quality calibration</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">Review Sampling</h1><p className="mt-2 text-sm text-muted">偏りが見えやすい候補を自動抽出し、AI評価と人間評価の差を記録します。</p></header>{rubric ? <ReviewSampling samples={samples} rubric={rubric} /> : <p className="mt-7 rounded-xl border p-8 text-sm text-muted">有効な評価基準がありません。</p>}</div>;
}
