import { VisualSearchWorkspace } from "@/components/visual-search-workspace";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function VisualSearchPage() {
  const user = await requireUser(); const supabase = await createClient();
  const { data } = await supabase.from("visual_searches").select("id,name,expires_at,created_at,visual_search_runs(status,result_count,started_at)").eq("created_by", user.id).order("created_at", { ascending: false }).limit(20);
  return <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9 xl:px-10"><header><p className="text-[10px] font-medium tracking-[.18em] text-muted uppercase">Visual reverse search</p><h1 className="mt-2 text-3xl font-medium tracking-[-.045em] sm:text-4xl">Visual Search</h1><p className="mt-2 text-sm text-muted">参考CGの作品傾向から、登録済み候補者との適合理由を探します。</p></header><VisualSearchWorkspace history={(data ?? []) as never[]}/></div>;
}
