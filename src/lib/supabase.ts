import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = rawSupabaseUrl
  ?.replace(/\/rest\/v1\/?$/, "")
  .replace(/\/$/, "");

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

// Do not throw at module load time. Vercel evaluates modules during build.
// We surface a clear runtime error from API/routes when env vars are missing.
const safeSupabaseUrl = supabaseUrl ?? "https://placeholder.supabase.co";
const safeSupabaseAnonKey = supabaseAnonKey ?? "placeholder-key";

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey);

export function assertSupabaseEnv() {
  if (!hasSupabaseEnv) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
}
