import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Only warn — don't throw, so the app still boots without Supabase configured
  if (typeof window === 'undefined') {
    console.warn('[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set. History will be unavailable.');
  }
}

// Safe fallback so imports don't crash when env vars are missing
export const supabase = (url && anonKey)
  ? createClient(url, anonKey)
  : null;

export function isSupabaseReady(): boolean {
  return supabase !== null;
}
