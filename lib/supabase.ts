import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy singleton — created only on first use, safe during SSR/build without credentials.
let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;          // not configured yet
  if (!_client) _client = createClient(url, key);
  return _client;
}

// ── Server-side admin client (service-role key — bypasses RLS) ───────────────
// NEVER import this in client components — server API routes only.
let _adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer dedicated service-role key; fall back to anon key in dev
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!_adminClient) _adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _adminClient;
}

export const isSupabaseConfigured = (): boolean =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
