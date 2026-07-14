import "server-only";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  DiscoveryItem,
  DiscoveryItemStatus,
  DiscoveryRun,
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
