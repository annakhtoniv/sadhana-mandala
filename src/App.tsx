import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { Sparkles, LogIn, CheckCircle2, AlertCircle } from 'lucide-react';

export default function App() {
  const [authError, setAuthError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Check existing auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured yet. Please enter your Supabase URL and Anon Key in .env.local.');
      return;
    }

    try {
      setIsSigningIn(true);
      setAuthError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initialize Google Sign-in';
      setAuthError(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setUserEmail(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
      {/* Top Header */}
      <header className="w-full border-b border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 flex items-center justify-center font-bold text-sm shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-base tracking-tight">Sadhana Mandala</span>
          </div>

          <div className="flex items-center gap-2">
            {isSupabaseConfigured ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-3 h-3" />
                <span>Supabase Ready</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-3 h-3" />
                <span>Setup Mode</span>
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container - Optimized for 400px mobile screen */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-8 flex flex-col justify-center items-center">
        <div className="w-full space-y-6 text-center">
          {/* Phase 0 Badge */}
          <div className="inline-block px-3 py-1 text-xs font-medium tracking-wide uppercase bg-stone-200/80 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 rounded-full">
            Phase 0 &bull; Setup & Connectivity
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
              Daily Practice Companion
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed max-w-xs mx-auto">
              A white-label platform for mindful daily commitments and teacher guidance.
            </p>
          </div>

          {/* Sign In Card */}
          <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            {userEmail ? (
              <div className="space-y-4">
                <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-left">
                  <div className="text-xs text-stone-500 dark:text-stone-400">Signed in as</div>
                  <div className="text-sm font-medium truncate text-stone-900 dark:text-stone-100">{userEmail}</div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full h-12 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-sm transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {isSupabaseConfigured
                    ? 'Authenticate securely using your Google account to get started.'
                    : 'Awaiting Supabase and Google OAuth credentials in .env.local.'}
                </p>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="w-full h-12 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 font-medium text-sm flex items-center justify-center gap-3 shadow hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isSigningIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
                </button>

                {authError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 text-left">
                    {authError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick status checklist */}
          <div className="bg-stone-100/70 dark:bg-stone-900/40 rounded-xl p-4 text-left border border-stone-200/60 dark:border-stone-800/60 text-xs space-y-2">
            <div className="font-medium text-stone-700 dark:text-stone-300 mb-1">Phase 0 Checklist</div>
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>React + Vite + TypeScript + Tailwind</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Installable PWA Manifest configured</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              <span>Supabase & Google Auth Integration</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
              <span>Deploy to sadhana.zyxenai.com</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer conforming strictly to the brief:
          - "Powered by ZYXENAI" when show_powered_by is true (default true)
          - Small "Concept" label in the footer
      */}
      <footer className="w-full border-t border-stone-200 dark:border-stone-800 py-4 bg-white/50 dark:bg-stone-900/50 mt-auto">
        <div className="max-w-md mx-auto px-4 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500">
          <span>Powered by ZYXENAI</span>
          <span className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-[10px] rounded font-medium tracking-wide uppercase">
            Concept
          </span>
        </div>
      </footer>
    </div>
  );
}
