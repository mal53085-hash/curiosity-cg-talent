import { z } from "zod";
import { isSameOrigin } from "@/lib/api-security";
import { normalizeCandidateUrl } from "@/lib/acquisition/import";
import { createClient } from "@/lib/supabase/server";
import { discoverySourceTypes } from "@/types/discovery";

const listSchema = z.array(z.string().trim().min(1).max(160)).max(30);
const researchStatusSchema = z.enum(["new", "reviewing", "needs_more_info", "ready_for_ai_review", "ready_for_approval"]);
const rowSchema = z.object({
  rowNumber: z.number().int().min(1).max(100),
  rawInput: z.string().min(1).max(10000),
  normalizedUrl: z.string().url().max(2048).nullable(),
  sourceType: z.enum(discoverySourceTypes).nullable(),
  supported: z.boolean(),
  duplicate: z.boolean(),
  duplicateKind: z.enum(["batch", "discovery", "candidate"]).nullable(),
  errors: z.array(z.string().max(300)).max(10),
  data: z.object({
    name: z.string().trim().max(200).optional(),
    source_type: z.enum(discoverySourceTypes).optional(),
    source_url: z.string().max(2048).optional(),
    portfolio_url: z.string().max(2048).optional(),
    region: z.string().trim().max(120).optional(),
    skills: listSchema.optional(), software: listSchema.optional(), languages: listSchema.optional(),
    employment_types: listSchema.optional(), work_location_preferences: listSchema.optional(),
    notes_for_review: z.string().max(5000).optional(),
    public_profile: z.string().max(5000).optional(),
    research_status: researchStatusSchema.optional(),
  }).strict(),
});
const requestSchema = z.object({
  kind: z.enum(["url", "csv", "manual"]),
  filename: z.string().max(255).optional(),
  columnMapping: z.record(z.string(), z.string()).optional(),
  rows: z.array(rowSchema).min(1).max(100),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "不正なリクエストです。" }, { status: 403 });
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return Response.json({ error: "ログインが必要です。" }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "確認データが不正です。もう一度プレビューしてください。" }, { status: 400 });

  const rows = parsed.data.rows.map((row) => {
    if (!row.normalizedUrl) return row;
    try {
      return { ...row, normalizedUrl: normalizeCandidateUrl(row.normalizedUrl) };
    } catch (error) {
      return { ...row, supported: false, errors: [...row.errors, error instanceof Error ? error.message : "URLが不正です。"] };
    }
  });
  const urls = rows.flatMap((row) => row.normalizedUrl ? [row.normalizedUrl] : []);
  const duplicateResults = urls.length ? await Promise.all([
    supabase.from("discovery_items").select("id,source_url").in("source_url", urls),
    supabase.from("candidates").select("id,source_url").in("source_url", urls),
  ]) : [{ data: [] }, { data: [] }];
  const [{ data: discoveries }, { data: candidates }] = duplicateResults;
  const discoveryByUrl = new Map((discoveries ?? []).map((item) => [item.source_url.toLowerCase(), item.id]));
  const candidateByUrl = new Map((candidates ?? []).flatMap((item) => item.source_url ? [[item.source_url.toLowerCase(), item.id] as const] : []));
  const seen = new Set<string>();
  const finalized = rows.map((row) => {
    if (!row.normalizedUrl) return row;
    const key = row.normalizedUrl.toLowerCase();
    const duplicateKind = seen.has(key) ? "batch" : discoveryByUrl.has(key) ? "discovery" : candidateByUrl.has(key) ? "candidate" : null;
    seen.add(key);
    return duplicateKind ? { ...row, duplicate: true, duplicateKind } : { ...row, duplicate: false, duplicateKind: null };
  });

  const { data: batch, error: batchError } = await supabase.from("acquisition_batches").insert({
    batch_type: parsed.data.kind,
    status: "confirmed",
    filename: parsed.data.filename || null,
    total_count: finalized.length,
    supported_count: finalized.filter((row) => row.supported).length,
    unsupported_count: finalized.filter((row) => !row.supported).length,
    duplicate_count: finalized.filter((row) => row.duplicate).length,
    column_mapping: parsed.data.columnMapping ?? {},
    summary: { pii_columns_ignored: true, auto_scraping: false },
    created_by: auth.user.id,
    confirmed_at: new Date().toISOString(),
  }).select("id").single();
  if (batchError || !batch) return Response.json({ error: "取込バッチを開始できませんでした。" }, { status: 500 });

  let created = 0;
  let failed = 0;
  for (const row of finalized) {
    const duplicateDiscoveryId = row.normalizedUrl ? discoveryByUrl.get(row.normalizedUrl.toLowerCase()) ?? null : null;
    const duplicateCandidateId = row.normalizedUrl ? candidateByUrl.get(row.normalizedUrl.toLowerCase()) ?? null : null;
    const { data: batchItem, error: itemError } = await supabase.from("acquisition_batch_items").insert({
      batch_id: batch.id,
      row_number: row.rowNumber,
      raw_input: row.rawInput,
      normalized_url: row.normalizedUrl,
      source_type: row.sourceType,
      supported: row.supported,
      is_duplicate: row.duplicate,
      duplicate_discovery_item_id: duplicateDiscoveryId,
      duplicate_candidate_id: duplicateCandidateId,
      parsed_data: row.data,
      validation_errors: row.errors,
    }).select("id").single();
    if (itemError || !batchItem) { failed += 1; continue; }
    if (!row.supported || row.duplicate || !row.normalizedUrl || !row.sourceType) continue;
    const sourceUrl = row.normalizedUrl;
    const portfolioUrl = row.data.portfolio_url
      ? (() => { try { return normalizeCandidateUrl(row.data.portfolio_url); } catch { return null; } })()
      : sourceUrl;
    const { data: discovery, error: discoveryError } = await supabase.from("discovery_items").insert({
      source_type: row.data.source_type ?? row.sourceType,
      source_url: sourceUrl,
      portfolio_url: portfolioUrl,
      title: "候補者リサーチ",
      author_name: row.data.name?.trim() || new URL(sourceUrl).hostname.replace(/^www\./, ""),
      description: row.data.public_profile?.trim() || null,
      country: row.data.region?.trim() || null,
      skills: row.data.skills ?? [], software: row.data.software ?? [], languages: row.data.languages ?? [],
      employment_types: row.data.employment_types ?? [], work_location_preferences: row.data.work_location_preferences ?? [],
      notes_for_review: row.data.notes_for_review?.trim() || null,
      research_status: row.data.research_status ?? "new",
      acquisition_batch_item_id: batchItem.id,
      recruiter_metadata: {}, raw_metadata: { acquisition_kind: parsed.data.kind },
      created_by: auth.user.id,
    }).select("id").single();
    if (discoveryError || !discovery) { failed += 1; continue; }
    await supabase.from("acquisition_batch_items").update({ discovery_item_id: discovery.id }).eq("id", batchItem.id);
    created += 1;
  }

  const status = failed > 0 ? (created > 0 ? "partial" : "failed") : "completed";
  await supabase.from("acquisition_batches").update({ status, created_count: created, error_count: failed, completed_at: new Date().toISOString() }).eq("id", batch.id);
  await supabase.from("audit_events").insert({
    event_type: "acquisition.batch_completed", resource_type: "acquisition_batch", resource_id: batch.id,
    metadata: { kind: parsed.data.kind, total: finalized.length, created, duplicates: finalized.filter((row) => row.duplicate).length, failed },
    actor_id: auth.user.id,
  });
  return Response.json({ batchId: batch.id, created, duplicates: finalized.filter((row) => row.duplicate).length, failed, status });
}
