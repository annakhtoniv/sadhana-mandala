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
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// The 1-click demo login stores a fake user here. Only in that mode may the app
// show sample data; a real Google session must always show what the database returns.
export const DEMO_SESSION_KEY = 'sadhana_demo_session';

export function isDemoMode(): boolean {
  try {
    return typeof localStorage !== 'undefined' && Boolean(localStorage.getItem(DEMO_SESSION_KEY));
  } catch {
    return false;
  }
}
