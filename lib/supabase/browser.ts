import { createClient } from "@supabase/supabase-js";

let browserClient: any | null = null;

export function getSupabaseBrowserClient(): any | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;

  if (!browserClient) {
    browserClient = createClient(url, key);
  }

  return browserClient;
}
