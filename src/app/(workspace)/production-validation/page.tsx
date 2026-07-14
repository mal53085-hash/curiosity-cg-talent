import { ProductionValidationChecklist } from "@/components/production-validation-checklist";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ProductionValidationPage() {
  await requireUser(); const supabase = await createClient();
  const { data } = await supabase.from("validation_checklists").select("id,code,label,description,sort_order,validation_checklist_runs(id,status,evidence_note,verified_by,verified_at)").eq("is_active", true).order("sort_order");
  const items = (data ?? []).map((item) => ({ ...item, validation_checklist_runs: [...(item.validation_checklist_runs ?? [])].sort((a, b) => b.verified_at.localeCompare(a.verified_at)).slice(0, 1) }));
  return <div className="mx-auto max-w-[1300px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><header><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Production validation</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">本番検証チェックリスト</h1><p className="mt-2 text-sm text-muted">本番で実施した確認だけを、確認者・日時・証跡とともに記録します。</p></header><ProductionValidationChecklist items={items} /></div>;
}
