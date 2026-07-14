import Link from "next/link";
import { RubricEditor } from "@/components/rubric-editor";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function CalibrationPage() {
  await requireUser(); const supabase = await createClient();
  const { data: rubric } = await supabase.from("evaluation_rubrics").select("id,name,description,evaluation_rubric_versions(id,version,axes,change_note,published_at)").eq("is_active", true).order("created_at").limit(1).maybeSingle();
  const versions = [...(rubric?.evaluation_rubric_versions ?? [])].sort((a, b) => b.version - a.version);
  const latest = versions[0];
  return <div className="mx-auto max-w-[1400px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Human review calibration</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">評価基準</h1><p className="mt-2 text-sm text-muted">Curiosityの12軸をversion管理し、AI評価と人間評価の基準を揃えます。</p></div><Link href="/calibration/reviews" className="rounded-lg border bg-surface px-4 py-2.5 text-xs">Review Sampling</Link></header>{rubric && latest ? <RubricEditor rubricId={rubric.id} rubricName={rubric.name} version={latest.version} axes={latest.axes as RubricAxis[]} history={versions.map((item) => ({ version: item.version, note: item.change_note, publishedAt: item.published_at }))} /> : <section className="mt-7 rounded-xl border bg-surface px-6 py-16 text-center text-sm text-muted">有効な評価基準がありません。Phase 4.5 migrationを適用してください。</section>}</div>;
}

export type RubricAxis = { key: string; label: string; description: string; good_example: string; concern_example: string; weight: number; required: boolean };
