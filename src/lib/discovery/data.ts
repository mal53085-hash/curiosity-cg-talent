import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  DiscoveryItem,
  DiscoveryItemStatus,
  DiscoveryRun,
  DiscoveryResearchStatus,
  DiscoverySource,
} from "@/types/discovery";

export async function getDiscoveryItems(status: DiscoveryItemStatus = "new") {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discovery_items")
    .select("*,discovery_sources(name)")
    .eq("status", status)
    .order("discovered_at", { ascending: false });
  if (error) throw new Error(`Discovery Inboxの取得に失敗しました: ${error.message}`);
  return (data ?? []) as unknown as DiscoveryItem[];
}

export async function getResearchItems(status?: DiscoveryResearchStatus) {
  await requireUser();
  const supabase = await createClient();
  let query = supabase.from("discovery_items").select("*,discovery_sources(name)").order("last_verified_at", { ascending: true, nullsFirst: true }).order("discovered_at", { ascending: false });
  if (status) query = query.eq("research_status", status);
  const { data, error } = await query.limit(200);
  if (error) throw new Error(`調査キューの取得に失敗しました: ${error.message}`);
  return (data ?? []) as unknown as DiscoveryItem[];
}

export async function getResearchItem(id: string) {
  await requireUser(); const supabase = await createClient();
  const [{ data: item, error }, { data: images, error: imagesError }] = await Promise.all([
    supabase.from("discovery_items").select("*").eq("id", id).maybeSingle(),
    supabase.from("candidate_portfolio_images").select("*").eq("discovery_item_id", id).order("image_order"),
  ]);
  if (error || !item) throw new Error("調査候補が見つかりません。");
  if (imagesError) throw new Error(`作品画像を取得できませんでした: ${imagesError.message}`);
  const paths = (images ?? []).flatMap((image) => image.storage_path ? [image.storage_path] : []);
  const signed = paths.length ? await supabase.storage.from("candidate-portfolio-images").createSignedUrls(paths, 3600) : { data: [] };
  const urls = new Map((signed.data ?? []).map((entry) => [entry.path, entry.signedUrl ?? null]));
  const allowedImage = (images ?? []).some((image) => image.selected_for_ai_review && image.storage_path && ["review_copy_authorized", "internal_reference_authorized"].includes(image.usage_status));
  const reasons = [
    ...(!item.description ? ["公開プロフィールがありません"] : []),
    ...(item.research_quality_score < 60 ? ["データ品質スコアが60未満です"] : []),
    ...(["rejected", "duplicate"].includes(item.research_status) ? ["見送りまたは重複候補です"] : []),
    ...(!allowedImage ? ["AI利用許可済みの選択画像がありません"] : []),
  ];
  return { item: item as unknown as import("@/types/discovery").DiscoveryItem, images: (images ?? []).map((image) => ({ ...image, preview_url: image.storage_path ? urls.get(image.storage_path) ?? null : image.external_url })) as import("@/types/portfolio").CandidatePortfolioImage[], eligibility: { eligible: reasons.length === 0, reasons } };
}

export async function getDiscoverySources() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discovery_sources")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`検索テーマの取得に失敗しました: ${error.message}`);
  return (data ?? []) as unknown as DiscoverySource[];
}

export async function getDiscoveryRuns() {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discovery_runs")
    .select("*,discovery_sources(name)")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`実行履歴の取得に失敗しました: ${error.message}`);
  return (data ?? []) as unknown as DiscoveryRun[];
}
