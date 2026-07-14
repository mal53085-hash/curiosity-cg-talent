"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { mapLegacyStatus } from "@/lib/candidates/japan-hiring";
import { createClient } from "@/lib/supabase/server";
import { hiringClosedReasons, hiringPipelineStages } from "@/types/candidate";

const idSchema = z.string().uuid();
const stageSchema = z.enum(hiringPipelineStages);
const closedReasonSchema = z.enum(hiringClosedReasons);

export async function updatePipelineAction(formData: FormData) {
  const id = idSchema.parse(String(formData.get("candidate_id") ?? ""));
  const stage = stageSchema.parse(String(formData.get("stage") ?? ""));
  const reasonValue = String(formData.get("closed_reason") ?? "");
  const closedReason = stage === "closed" && reasonValue ? closedReasonSchema.parse(reasonValue) : null;
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("candidates").update({
    hiring_pipeline_stage: stage,
    hiring_closed_reason: closedReason,
    status: stage === "closed" && closedReason === "hired" ? "hired" : stage === "closed" && closedReason === "rejected_by_company" ? "rejected" : mapLegacyStatus(stage),
    updated_by: user.id,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  await supabase.from("candidate_interactions").insert({ candidate_id: id, kind: "status_change", summary: `Pipeline changed to ${stage}${closedReason ? ` (${closedReason})` : ""}`, created_by: user.id });
  revalidatePath("/dashboard");
  revalidatePath("/candidates");
  revalidatePath("/hiring-pipeline");
  revalidatePath(`/candidates/${id}`);
}

export async function quickCandidateAction(id: string, action: "shortlist" | "close", _formData: FormData) {
  void _formData;
  const formData = new FormData();
  formData.set("candidate_id", id);
  formData.set("stage", action === "shortlist" ? "shortlist" : "closed");
  if (action === "close") formData.set("closed_reason", "future_candidate");
  await updatePipelineAction(formData);
}

export async function setUiModeAction(formData: FormData) {
  const mode = z.enum(["simple", "advanced"]).parse(String(formData.get("ui_mode") ?? "simple"));
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("user_preferences").upsert({ user_id: user.id, ui_mode: mode, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  redirect("/settings");
}
