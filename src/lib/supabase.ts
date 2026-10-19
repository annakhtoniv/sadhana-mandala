import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder-project')
);

// Create the Supabase client with anon key only.
// In the browser, the service role key is NEVER used.
// Sign-in returns a one-time code that only works with a secret key kept on
// this device (PKCE), so it can be handed from the iPhone's Safari window to
// the Home Screen app (Phase 19, lib/signInHandoff.ts).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  { auth: { flowType: 'pkce' } }
);
