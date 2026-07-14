import "server-only";

import { createClient } from "@supabase/supabase-js";
import { requireSupabaseConfig } from "./config";

export function createAdminClient() {
  const { url } = requireSupabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!key) throw new Error("SUPABASE_SECRET_KEYが設定されていません。");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
