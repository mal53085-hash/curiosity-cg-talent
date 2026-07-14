import Link from "next/link";
import { ScoutTestManager } from "@/components/scout-test-manager";
import { getCandidates } from "@/lib/candidates/data";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ScoutTestsPage() {
  const user = await requireUser(); const supabase = await createClient();
  const [candidates, { data }] = await Promise.all([getCandidates(), supabase.from("scout_test_cases").select("id,name,query,scout_test_runs(id,precision_at_3,precision_at_5,sample_size,sample_status,executed_at,status)").eq("created_by", user.id).order("created_at", { ascending: false })]);
  const cases = (data ?? []).map((item) => ({ ...item, scout_test_runs: [...(item.scout_test_runs ?? [])].sort((a, b) => b.executed_at.localeCompare(a.executed_at)).slice(0, 1) }));
  return <div className="mx-auto max-w-[1300px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><Link href="/data-quality" className="text-xs text-muted hover:text-foreground">← データ品質へ</Link><header className="mt-5"><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Evaluation lab</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em]">AI Scout評価テスト</h1><p className="mt-2 text-sm text-muted">想定順位と実際の順位を保存し、検索品質を継続的に検証します。20名未満はサンプル不足です。</p></header><ScoutTestManager candidates={candidates.map((c) => ({ id: c.id, full_name: c.full_name }))} cases={cases}/></div>;
}
