"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  candidateSchema,
  nullable,
  splitList,
  type CandidateInput,
} from "@/lib/candidates/validation";

export type CandidateActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | undefined;

const idSchema = z.string().uuid();
const acceptedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function rawCandidate(formData: FormData) {
  const names = [
    "full_name",
    "email",
    "phone",
    "country",
    "city",
    "primary_role",
    "years_experience",
    "skills",
    "software",
    "languages",
    "tags",
    "project_fit_tags",
    "availability",
    "status",
    "rating",
    "portfolio_url",
    "source_url",
    "public_profile",
    "employment_types",
    "work_location_preferences",
    "expected_salary_jpy",
    "current_country",
    "current_city",
    "japan_residency_status",
    "japan_work_authorization",
    "visa_status",
    "japanese_level",
    "english_level",
    "interested_in_japan",
    "willing_to_relocate_to_japan",
    "willing_to_work_in_tokyo",
    "remote_from_overseas",
    "full_time_interest",
    "freelance_interest",
    "earliest_start_date",
    "hiring_readiness_status",
    "hiring_readiness_confidence",
    "hiring_readiness_evidence",
    "readiness_verification_status",
    "hiring_pipeline_stage",
    "hiring_closed_reason",
    "next_action",
    "next_interview_at",
    "notes",
  ] as const;

  return Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? "")]));
}

function candidatePayload(input: CandidateInput, userId: string, formData: FormData) {
  const bool = (value: "" | "true" | "false") => value === "" ? null : value === "true";
  const readinessFields = ["current_country","current_city","japan_residency_status","japan_work_authorization","visa_status","japanese_level","english_level","interested_in_japan","willing_to_relocate_to_japan","willing_to_work_in_tokyo","remote_from_overseas","full_time_interest","freelance_interest","earliest_start_date"];
  const allowedVerification = new Set(["verified","self_declared","publicly_indicated","unknown","needs_confirmation"]);
  const readinessVerification = Object.fromEntries(readinessFields.map((field) => { const value = String(formData.get(`${field}_verification`) ?? input.readiness_verification_status); return [field, allowedVerification.has(value) ? value : "unknown"]; }));
  return {
    full_name: input.full_name,
    email: nullable(input.email),
    phone: nullable(input.phone),
    country: input.country,
    city: nullable(input.city),
    primary_role: input.primary_role,
    years_experience: input.years_experience === "" ? null : input.years_experience,
    skills: splitList(input.skills),
    software: splitList(input.software),
    languages: splitList(input.languages),
    tags: splitList(input.tags),
    project_fit_tags: splitList(input.project_fit_tags),
    availability: nullable(input.availability),
    status: input.status,
    rating: input.rating,
    portfolio_url: nullable(input.portfolio_url),
    source_url: nullable(input.source_url),
    public_profile: nullable(input.public_profile),
    employment_types: splitList(input.employment_types),
    work_location_preferences: splitList(input.work_location_preferences),
    expected_salary_jpy: input.expected_salary_jpy === "" ? null : input.expected_salary_jpy,
    current_country: nullable(input.current_country),
    current_city: nullable(input.current_city),
    japan_residency_status: nullable(input.japan_residency_status),
    japan_work_authorization: bool(input.japan_work_authorization),
    visa_status: nullable(input.visa_status),
    japanese_level: nullable(input.japanese_level),
    english_level: nullable(input.english_level),
    interested_in_japan: bool(input.interested_in_japan),
    willing_to_relocate_to_japan: bool(input.willing_to_relocate_to_japan),
    willing_to_work_in_tokyo: bool(input.willing_to_work_in_tokyo),
    remote_from_overseas: bool(input.remote_from_overseas),
    full_time_interest: bool(input.full_time_interest),
    freelance_interest: bool(input.freelance_interest),
    earliest_start_date: nullable(input.earliest_start_date),
    hiring_readiness_status: input.hiring_readiness_status,
    hiring_readiness_confidence: input.hiring_readiness_confidence,
    hiring_readiness_evidence: nullable(input.hiring_readiness_evidence),
    readiness_verification: readinessVerification,
    hiring_readiness_verified_at: Object.values(readinessVerification).some((value) => value === "verified") ? new Date().toISOString() : null,
    hiring_pipeline_stage: input.hiring_pipeline_stage,
    hiring_closed_reason: input.hiring_pipeline_stage === "closed" && input.hiring_closed_reason ? input.hiring_closed_reason : null,
    next_action: nullable(input.next_action),
    next_interview_at: nullable(input.next_interview_at),
    notes: nullable(input.notes),
    updated_by: userId,
  };
}

function getImage(formData: FormData) {
  const value = formData.get("image");
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > 8 * 1024 * 1024) throw new Error("画像は8MB以下にしてください。");
  if (!acceptedImageTypes.has(value.type)) {
    throw new Error("JPEG、PNG、WebP形式の画像を選択してください。");
  }
  return value;
}

async function uploadImage(candidateId: string, image: File) {
  const supabase = await createClient();
  const extension = acceptedImageTypes.get(image.type)!;
  const path = `${candidateId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("candidate-images")
    .upload(path, new Uint8Array(await image.arrayBuffer()), {
      contentType: image.type,
      upsert: false,
    });
  if (error) throw new Error(`画像のアップロードに失敗しました: ${error.message}`);
  return path;
}

function parseCandidate(formData: FormData):
  | { success: true; data: CandidateInput }
  | { success: false; state: CandidateActionState } {
  const parsed = candidateSchema.safeParse(rawCandidate(formData));
  if (!parsed.success) {
    return {
      success: false,
      state: {
        error: "入力内容を確認してください。",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
    };
  }
  return { success: true, data: parsed.data };
}

export async function createCandidateAction(
  _state: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  const parsed = parseCandidate(formData);
  if (!parsed.success) return parsed.state;

  let candidateId: string | undefined;
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const image = getImage(formData);
    const { data, error } = await supabase
      .from("candidates")
      .insert({ ...candidatePayload(parsed.data, user.id, formData), created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    const insertedId = data.id as string;
    candidateId = insertedId;

    if (image) {
      const imagePath = await uploadImage(insertedId, image);
      const { error: updateError } = await supabase
        .from("candidates")
        .update({ image_path: imagePath, work_image_count: 1 })
        .eq("id", insertedId);
      if (updateError) {
        await supabase.storage.from("candidate-images").remove([imagePath]);
        throw updateError;
      }
    }
  } catch (error) {
    if (candidateId) {
      const supabase = await createClient();
      await supabase.from("candidates").delete().eq("id", candidateId);
    }
    return {
      error: error instanceof Error ? error.message : "候補者を保存できませんでした。",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  redirect(`/candidates/${candidateId}`);
}

export async function updateCandidateAction(
  id: string,
  _state: CandidateActionState,
  formData: FormData,
): Promise<CandidateActionState> {
  if (!idSchema.safeParse(id).success) return { error: "候補者IDが不正です。" };
  const parsed = parseCandidate(formData);
  if (!parsed.success) return parsed.state;

  let newImagePath: string | null = null;
  try {
    const user = await requireUser();
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("candidates")
      .select("image_path")
      .eq("id", id)
      .single();
    if (readError) throw readError;

    const image = getImage(formData);
    const removeImage = formData.get("remove_image") === "on";
    if (image) newImagePath = await uploadImage(id, image);

    const imagePath = image
      ? newImagePath
      : removeImage
        ? null
        : current.image_path;
    const { error: updateError } = await supabase
      .from("candidates")
      .update({ ...candidatePayload(parsed.data, user.id, formData), image_path: imagePath, work_image_count: imagePath ? 1 : 0 })
      .eq("id", id);
    if (updateError) throw updateError;

    if ((image || removeImage) && current.image_path) {
      await supabase.storage.from("candidate-images").remove([current.image_path]);
    }
  } catch (error) {
    if (newImagePath) {
      const supabase = await createClient();
      await supabase.storage.from("candidate-images").remove([newImagePath]);
    }
    return {
      error: error instanceof Error ? error.message : "候補者を更新できませんでした。",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath(`/candidates/${id}`);
  redirect(`/candidates/${id}`);
}

export async function deleteCandidateAction(id: string) {
  if (!idSchema.safeParse(id).success) throw new Error("候補者IDが不正です。");
  const user = await requireUser();
  const supabase = await createClient();
  const { data: candidate, error: readError } = await supabase
    .from("candidates")
    .select("image_path")
    .eq("id", id)
    .single();
  if (readError) throw new Error(readError.message);
  const { data: portfolioImages, error: portfolioError } = await supabase
    .from("candidate_portfolio_images")
    .select("storage_path")
    .eq("candidate_id", id);
  if (portfolioError) throw new Error(portfolioError.message);

  if (candidate.image_path) {
    const { error: storageError } = await supabase.storage
      .from("candidate-images")
      .remove([candidate.image_path]);
    if (storageError) throw new Error(storageError.message);
  }

  const portfolioPaths = (portfolioImages ?? []).flatMap((image) => image.storage_path ? [image.storage_path] : []);
  if (portfolioPaths.length) {
    const { error: portfolioStorageError } = await supabase.storage.from("candidate-portfolio-images").remove(portfolioPaths);
    if (portfolioStorageError) throw new Error(portfolioStorageError.message);
  }

  await supabase.from("audit_events").insert({ event_type: "candidate.deleted", resource_type: "candidate", resource_id: id, metadata: { legacy_image_deleted: Boolean(candidate.image_path), portfolio_images_deleted: portfolioPaths.length }, actor_id: user.id });

  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  redirect("/candidates");
}
