import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

// We still export a typed client when not configured so imports don't break at
// build time; calls will fail loudly at runtime instead, which is easier to
// diagnose than a silent misconfig.
export const supabase: SupabaseClient = createClient(
  url || 'https://missing.supabase.co',
  key || 'missing-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Implicit flow lets magic links be clicked from any browser/device
      // without requiring the code verifier that PKCE stores client-side.
      flowType: 'implicit',
      storageKey: 'fb-takeoff-auth',
    },
  }
);

export const PLANS_BUCKET = 'plans';
