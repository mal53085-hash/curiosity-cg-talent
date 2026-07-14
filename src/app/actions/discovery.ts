"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fetchPublicImage, identifySource } from "@/lib/discovery/safe-web";
import { discoverySourceTypes, type DiscoverySourceType } from "@/types/discovery";

export type DiscoveryActionState =
  | { ok?: boolean; message?: string; error?: string }
  | undefined;

const urlSchema = z.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" || url.protocol === "http:";
}, "httpまたはhttpsのURLを入力してください。");

function normalizedUrl(value: string) {
  const url = new URL(value.trim());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(
    (key) => url.searchParams.delete(key),
  );
  return url.toString();
}

function parseSourceType(value: FormDataEntryValue | null): DiscoverySourceType {
  const type = String(value ?? "manual");
  return discoverySourceTypes.includes(type as DiscoverySourceType)
    ? (type as DiscoverySourceType)
    : "manual";
}

function splitList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/[,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export async function createDiscoveryItemAction(
  _state: DiscoveryActionState,
  formData: FormData,
): Promise<DiscoveryActionState> {
  const user = await requireUser();
  const parsed = z.object({
    source_url: urlSchema,
    title: z.string().trim().min(1).max(300),
    author_name: z.string().trim().min(1).max(200),
    external_id: z.string().trim().max(300),
    description: z.string().trim().max(5000),
    country: z.string().trim().max(120),
    thumbnail_url: z.union([z.literal(""), urlSchema]),
  }).safeParse({
    source_url: String(formData.get("source_url") ?? "").trim(),
    title: String(formData.get("title") ?? ""),
    author_name: String(formData.get("author_name") ?? ""),
    external_id: String(formData.get("external_id") ?? ""),
    description: String(formData.get("description") ?? ""),
    country: String(formData.get("country") ?? ""),
    thumbnail_url: String(formData.get("thumbnail_url") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" };

  const detectedType = identifySource(new URL(parsed.data.source_url));
  const submittedType = parseSourceType(formData.get("source_type"));
  const sourceType = detectedType === "website" && submittedType !== "manual"
    ? submittedType
    : detectedType;
  const supabase = await createClient();
  const { error } = await supabase.from("discovery_items").insert({
    source_type: sourceType,
    source_url: normalizedUrl(parsed.data.source_url),
    external_id: parsed.data.external_id || null,
    title: parsed.data.title,
    author_name: parsed.data.author_name,
    description: parsed.data.description || null,
    country: parsed.data.country || null,
    skills: splitList(formData.get("skills")),
    thumbnail_url: parsed.data.thumbnail_url || null,
    portfolio_image_urls: parsed.data.thumbnail_url ? [parsed.data.thumbnail_url] : [],
    recruiter_metadata: sourceType === "linkedin" ? {
      recruiter_project: String(formData.get("recruiter_project") ?? "").trim() || null,
      recruiter_stage: String(formData.get("recruiter_stage") ?? "").trim() || null,
      recruiter_notes: String(formData.get("recruiter_notes") ?? "").trim() || null,
    } : {},
    created_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "同じURLまたはexternal IDの候補は既に登録されています。" };
    return { error: `Inboxへの登録に失敗しました: ${error.message}` };
  }
  revalidatePath("/discovery");
  return { ok: true, message: "Discovery Inboxへ登録しました。" };
}

export async function createDiscoverySourceAction(formData: FormData) {
  const user = await requireUser();
  const parsed = z.object({
    name: z.string().trim().min(1).max(160),
    search_query: z.string().trim().min(1).max(400),
    country_hint: z.string().trim().max(120),
    daily_limit: z.coerce.number().int().min(1).max(20),
  }).safeParse({
    name: formData.get("name"),
    search_query: formData.get("search_query"),
    country_hint: formData.get("country_hint"),
    daily_limit: formData.get("daily_limit"),
  });
  if (!parsed.success) throw new Error("検索テーマの入力内容を確認してください。");
  const supabase = await createClient();
  const { error } = await supabase.from("discovery_sources").insert({
    ...parsed.data,
    country_hint: parsed.data.country_hint || null,
    source_type: parseSourceType(formData.get("source_type")),
    created_by: user.id,
  });
  if (error) throw new Error(error.code === "23505" ? "同名の検索テーマがあります。" : error.message);
  revalidatePath("/discovery/sources");
}

export async function toggleDiscoverySourceAction(id: string, enabled: boolean) {
  await requireUser();
  if (!z.string().uuid().safeParse(id).success) throw new Error("IDが不正です。");
  const supabase = await createClient();
  const { error } = await supabase.from("discovery_sources").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/discovery/sources");
}

async function approveItem(id: string, userId: string) {
  const supabase = await createClient();
  const { data: item, error: readError } = await supabase
    .from("discovery_items")
    .select("*")
    .eq("id", id)
    .eq("status", "new")
    .maybeSingle();
  if (readError || !item) throw new Error("未処理のDiscovery候補が見つかりません。");

  const evaluation = item.preliminary_ai_evaluation as Record<string, unknown> | null;
  const scores = evaluation?.scores as Record<string, number> | undefined;
  const { data: candidate, error: insertError } = await supabase.from("candidates").insert({
    full_name: item.author_name,
    country: item.country || "Unknown",
    primary_role: item.title,
    skills: item.skills,
    software: item.software ?? [],
    languages: item.languages ?? [],
    employment_types: item.employment_types ?? [],
    work_location_preferences: item.work_location_preferences ?? [],
    tags: item.tags ?? [],
    project_fit_tags: item.project_fit_tags ?? [],
    status: "sourcing",
    rating: "unrated",
    portfolio_url: item.source_url,
    source_url: item.source_url,
    public_profile: item.description,
    source_type: item.source_type,
    external_id: item.external_id,
    discovered_at: item.discovered_at,
    discovery_item_id: item.id,
    ai_score: item.preliminary_ai_score,
    ai_scores: scores ?? {},
    ai_summary: item.preliminary_ai_summary,
    ai_reasoning: evaluation?.reasoning ?? null,
    ai_strengths: evaluation?.strengths ?? [],
    ai_risks: evaluation?.concerns ?? [],
    ai_recommended_projects: evaluation?.recommended_projects ?? [],
    ai_interview_questions: evaluation?.interview_questions ?? [],
    ai_model: evaluation ? "gpt-5.4-mini" : null,
    ai_evaluated_at: evaluation ? new Date().toISOString() : null,
    created_by: userId,
    updated_by: userId,
  }).select("id").single();
  if (insertError) {
    if (insertError.code === "23505") throw new Error("同じ候補者が既に正式候補へ登録されています。");
    throw new Error(insertError.message);
  }

  if (item.thumbnail_url) {
    try {
      const image = await fetchPublicImage(item.thumbnail_url);
      const extension = image.contentType === "image/jpeg" ? "jpg" : image.contentType.split("/")[1];
      const imagePath = `${candidate.id}/${crypto.randomUUID()}.${extension}`;
      const { error: imageError } = await supabase.storage.from("candidate-images").upload(imagePath, image.bytes, { contentType: image.contentType, upsert: false });
      if (!imageError) await supabase.from("candidates").update({ image_path: imagePath, work_image_count: 1 }).eq("id", candidate.id);
    } catch {
      // A remote thumbnail is optional. Approval remains human-controlled and can continue without it.
    }
  }

  const { error: updateError } = await supabase.from("discovery_items").update({
    status: "approved",
    candidate_id: candidate.id,
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId,
  }).eq("id", id).eq("status", "new");
  if (updateError) {
    await supabase.from("candidates").delete().eq("id", candidate.id);
    throw new Error(updateError.message);
  }
}

export async function reviewDiscoveryItemAction(
  id: string,
  decision: "approve" | "reject" | "duplicate",
) {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) throw new Error("候補IDが不正です。");
  if (decision === "approve") {
    await approveItem(id, user.id);
  } else {
    const supabase = await createClient();
    const { error } = await supabase.from("discovery_items").update({
      status: decision === "reject" ? "rejected" : "duplicate",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq("id", id).eq("status", "new");
    if (error) throw new Error(error.message);
  }
  revalidatePath("/discovery");
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
}

export async function bulkReviewDiscoveryAction(formData: FormData) {
  const user = await requireUser();
  const ids = formData.getAll("item_id").map(String).filter((id) => z.string().uuid().safeParse(id).success).slice(0, 50);
  const decision = String(formData.get("decision"));
  if (ids.length === 0) throw new Error("候補を選択してください。");
  if (!["approve", "reject", "duplicate"].includes(decision)) throw new Error("処理が不正です。");
  for (const id of ids) {
    if (decision === "approve") await approveItem(id, user.id);
    else {
      const supabase = await createClient();
      const { error } = await supabase.from("discovery_items").update({
        status: decision === "reject" ? "rejected" : "duplicate",
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      }).eq("id", id).eq("status", "new");
      if (error) throw new Error(error.message);
    }
  }
  revalidatePath("/discovery");
  revalidatePath("/candidates");
  revalidatePath("/dashboard");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export async function importLinkedInCsvAction(formData: FormData) {
  const user = await requireUser();
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0 || file.size > 1024 * 1024) throw new Error("1MB以下のCSVを選択してください。");
  const rows = parseCsv(await file.text());
  if (rows.length < 2 || rows.length > 501) throw new Error("CSVはヘッダーを含め2〜501行にしてください。");
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const required = ["profile_url", "name"];
  if (required.some((name) => !headers.includes(name))) throw new Error("profile_url,name列が必要です。");
  const indexOf = (name: string) => headers.indexOf(name);
  const supabase = await createClient();
  const { data: job, error: jobError } = await supabase.from("import_jobs").insert({
    source_type: "linkedin", filename: file.name.slice(0, 255), status: "processing",
    total_rows: rows.length - 1, created_by: user.id,
  }).select("id").single();
  if (jobError) throw new Error(jobError.message);
  let created = 0; let duplicates = 0; let failed = 0; const errors: string[] = [];
  for (const [offset, row] of rows.slice(1).entries()) {
    try {
      const url = urlSchema.parse(row[indexOf("profile_url")]?.trim());
      const name = row[indexOf("name")]?.trim();
      if (!name) throw new Error("nameが空です");
      const { error } = await supabase.from("discovery_items").insert({
        source_type: "linkedin", source_url: normalizedUrl(url), title: row[indexOf("headline")]?.trim() || "LinkedIn profile",
        author_name: name.slice(0, 200), country: row[indexOf("country")]?.trim() || null,
        skills: (row[indexOf("skills")] ?? "").split(/[;、]/).map((value) => value.trim()).filter(Boolean).slice(0, 30),
        recruiter_metadata: { project: row[indexOf("project")]?.trim() || null, stage: row[indexOf("stage")]?.trim() || null },
        created_by: user.id,
      });
      if (error?.code === "23505") duplicates += 1;
      else if (error) throw new Error(error.message);
      else created += 1;
    } catch (error) { failed += 1; errors.push(`${offset + 2}行目: ${error instanceof Error ? error.message : "不明なエラー"}`); }
  }
  await supabase.from("import_jobs").update({
    status: failed === rows.length - 1 ? "failed" : "completed", processed_rows: rows.length - 1,
    created_rows: created, duplicate_rows: duplicates, failed_rows: failed, error_log: errors.slice(0, 50), completed_at: new Date().toISOString(),
  }).eq("id", job.id);
  revalidatePath("/discovery");
  revalidatePath("/discovery/import");
}
