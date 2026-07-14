"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  const { url, key } = requireSupabaseConfig();
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
