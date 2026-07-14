const CONFIG_ERROR =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  return { url, key };
}

export function requireSupabaseConfig() {
  const config = getSupabaseConfig();
  if (!config) throw new Error(CONFIG_ERROR);
  return config;
}

export { CONFIG_ERROR };
