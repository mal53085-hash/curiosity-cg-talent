import "server-only";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type UiMode = "simple" | "advanced";

export async function getUiMode(): Promise<UiMode> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("user_preferences").select("ui_mode").eq("user_id", user.id).maybeSingle();
  return data?.ui_mode === "advanced" ? "advanced" : "simple";
}
