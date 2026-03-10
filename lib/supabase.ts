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

export const isSupabaseConfigured = (): boolean =>
  !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
