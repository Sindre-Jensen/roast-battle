import { createClient } from "@supabase/supabase-js";

const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = rawSupabaseUrl
  ?.replace(/\/rest\/v1\/?$/, "")
  .replace(/\/$/, "");

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
export const hasSupabaseServiceRoleEnv = Boolean(
  supabaseUrl && supabaseServiceRoleKey
);

// Do not throw at module load time. Vercel evaluates modules during build.
// We surface a clear runtime error from API/routes when env vars are missing.
const safeSupabaseUrl = supabaseUrl ?? "https://placeholder.supabase.co";
const safeSupabaseAnonKey = supabaseAnonKey ?? "placeholder-key";
const safeSupabaseServiceRoleKey = supabaseServiceRoleKey ?? "placeholder-key";

export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey);
export const supabaseServer = createClient(
  safeSupabaseUrl,
  safeSupabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export function assertSupabaseEnv() {
  if (!hasSupabaseEnv) {
    throw new Error(
      "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
}

export function assertSupabaseServiceRoleEnv() {
  if (!hasSupabaseServiceRoleEnv) {
    throw new Error("Missing Supabase env var: SUPABASE_SERVICE_ROLE_KEY");
  }
}
