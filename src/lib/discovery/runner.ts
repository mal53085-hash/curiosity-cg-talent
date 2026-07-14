import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiscoverySource, DiscoverySourceType } from "@/types/discovery";

type SearchResult = { title?: string; url?: string; description?: string; thumbnail?: { src?: string } };

function providerQuery(source: DiscoverySource) {
  const domain: Partial<Record<DiscoverySourceType, string>> = {
    behance: "behance.net",
    artstation: "artstation.com",
  };
  const site = domain[source.source_type];
  return site ? `site:${site} ${source.search_query}` : source.search_query;
}

function inferredAuthor(resultUrl: URL, title: string) {
  const byline = title.match(/\bby\s+([^|–—-]+)/i)?.[1]?.trim();
  if (byline) return byline.slice(0, 200);
  const segments = resultUrl.pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments[0] || resultUrl.hostname).replace(/[-_]/g, " ").slice(0, 200);
}

export async function runDiscoverySource(admin: SupabaseClient, source: DiscoverySource) {
  const { data: run, error: runError } = await admin.from("discovery_runs").insert({
    source_id: source.id,
    trigger_type: "cron",
    status: "running",
  }).select("id").single();
  if (runError) throw new Error(runError.message);

  const finish = async (values: Record<string, unknown>) => {
    await admin.from("discovery_runs").update({ ...values, completed_at: new Date().toISOString() }).eq("id", run.id);
    await admin.from("discovery_sources").update({ last_run_at: new Date().toISOString() }).eq("id", source.id);
  };

  if (["manual", "linkedin"].includes(source.source_type)) {
    await finish({ status: "skipped", error_message: source.source_type === "linkedin" ? "LinkedInはURL手動登録とCSV取り込みだけに制限されています。" : "手動ソースは自動探索の対象外です。" });
    return { status: "skipped" as const, created: 0 };
  }

  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const storageConfirmed = process.env.BRAVE_SEARCH_STORAGE_RIGHTS_CONFIRMED === "true";
  if (!apiKey || !storageConfirmed) {
    await finish({ status: "skipped", error_message: "保存権を含むBrave Search API契約とサーバー環境変数が未設定です。" });
    return { status: "skipped" as const, created: 0 };
  }

  try {
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", providerQuery(source));
    endpoint.searchParams.set("count", String(Math.min(source.daily_limit, 20)));
    endpoint.searchParams.set("result_filter", "web");
    endpoint.searchParams.set("safesearch", "moderate");
    const response = await fetch(endpoint, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "application/json", "x-subscription-token": apiKey },
    });
    if (!response.ok) throw new Error(`検索プロバイダーがHTTP ${response.status}を返しました。`);
    const body = await response.json() as { web?: { results?: SearchResult[] } };
    const results = (body.web?.results ?? []).slice(0, source.daily_limit);
    let created = 0;
    let duplicates = 0;
    for (const result of results) {
      if (!result.url || !result.title || !URL.canParse(result.url)) continue;
      const resultUrl = new URL(result.url);
      if (!['http:', 'https:'].includes(resultUrl.protocol)) continue;
      const expectedDomain = source.source_type === "behance" ? "behance.net" : source.source_type === "artstation" ? "artstation.com" : null;
      if (expectedDomain && resultUrl.hostname !== expectedDomain && !resultUrl.hostname.endsWith(`.${expectedDomain}`)) continue;
      resultUrl.hash = "";
      const { error } = await admin.from("discovery_items").insert({
        source_id: source.id,
        source_type: source.source_type,
        source_url: resultUrl.toString(),
        title: result.title.slice(0, 300),
        author_name: inferredAuthor(resultUrl, result.title),
        description: result.description?.slice(0, 5000) || null,
        country: source.country_hint,
        thumbnail_url: result.thumbnail?.src || null,
        portfolio_image_urls: result.thumbnail?.src ? [result.thumbnail.src] : [],
        raw_metadata: { provider: "brave_search", query: source.search_query },
      });
      if (error?.code === "23505") duplicates += 1;
      else if (error) throw new Error(error.message);
      else created += 1;
    }
    await finish({ status: "succeeded", items_found: results.length, items_created: created, duplicates_found: duplicates, log: { provider: "brave_search", bounded: true, daily_limit: source.daily_limit } });
    return { status: "succeeded" as const, created };
  } catch (error) {
    await finish({ status: "failed", error_message: error instanceof Error ? error.message.slice(0, 1000) : "探索に失敗しました。" });
    return { status: "failed" as const, created: 0 };
  }
}
