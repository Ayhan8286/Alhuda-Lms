import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy-initialized admin client — avoids placeholder fallback that silently fails on Vercel
let _supabaseAdmin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE environment variables. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your Vercel project settings."
    );
  }

  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _supabaseAdmin;
}

// Keep backward-compatible named export as a getter
// This ensures existing `supabaseAdmin.from(...)` calls still work
// but will throw a clear error if env vars are missing
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
