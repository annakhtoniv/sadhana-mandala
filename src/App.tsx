import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ConsentModal } from './components/ConsentModal';
import { StudentHome } from './components/StudentHome';
import { TeacherHome } from './components/TeacherHome';
import { AdminHome } from './components/AdminHome';
import { ProfileScreen } from './components/ProfileScreen';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { LogIn, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

function MainApp() {
  const { user, activeRole, setActiveRole, hasConsent, isLoading, organisation } = useAuth();
  const [currentTab, setCurrentTab] = useState<'home' | 'lessons' | 'profile'>('home');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      setAuthError('Supabase is not configured. Please ensure your Supabase keys are in .env.local.');
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
      const msg = err instanceof Error ? err.message : 'Failed to connect to Google Sign-in';
      setAuthError(msg);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Loading spinner
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-stone-50 dark:bg-stone-950 text-stone-500">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        <span className="text-xs mt-3 tracking-wide">Loading {organisation.app_name}...</span>
      </div>
    );
  }

  // Not signed in: White-label landing page
  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
        <header className="w-full border-b border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-stone-900/70 backdrop-blur sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {organisation.logo_url ? (
                <img src={organisation.logo_url} alt={organisation.app_name} className="w-8 h-8 rounded-full" />
              ) : (
                <div
                  className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm"
                  style={{ backgroundColor: organisation.primary_colour || '#1c1917' }}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
              )}
              <span className="font-semibold text-base tracking-tight">{organisation.app_name}</span>
            </div>

            <span className="text-[11px] text-stone-400 dark:text-stone-500 font-mono">
              v1.0
            </span>
          </div>
        </header>

        <main className="flex-1 w-full max-w-md mx-auto px-4 py-10 flex flex-col justify-center items-center">
          <div className="w-full space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
                {organisation.app_name}
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed max-w-xs mx-auto">
                {organisation.footer_text || 'A mindful daily practice companion for 40-day meditation commitments.'}
              </p>
            </div>

            <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Sign in with your Google account to access your daily practice, track streaks, and connect with your teacher.
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
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400 text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-stone-100/60 dark:bg-stone-900/40 border border-stone-200/50 dark:border-stone-800/50 text-left text-xs text-stone-500 space-y-1">
              <div className="font-medium text-stone-700 dark:text-stone-300">Organisation Workspace:</div>
              <div>{organisation.name} ({organisation.timezone})</div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Signed in
  return (
    <div className="flex flex-col min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 transition-colors">
      {!hasConsent && <ConsentModal />}

      {/* Navigation Header */}
      <Header
        currentTab={currentTab}
        onNavigate={(tab) => setCurrentTab(tab as 'home' | 'lessons' | 'profile')}
        activeRoleView={activeRole}
        onRoleSwitch={(newRole) => setActiveRole(newRole)}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-6">
        {currentTab === 'profile' ? (
          <ProfileScreen onBack={() => setCurrentTab('home')} />
        ) : currentTab === 'lessons' ? (
          <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">Lessons</h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              General and batch practice lessons will be published in Phase 5.
            </p>
            <button
              type="button"
              onClick={() => setCurrentTab('home')}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              &larr; Back to Daily Practice
            </button>
          </div>
        ) : (
          /* Role-based Home Navigation */
          activeRole === 'admin' ? (
            <AdminHome />
          ) : activeRole === 'teacher' ? (
            <TeacherHome />
          ) : (
            <StudentHome onNavigateLessons={() => setCurrentTab('lessons')} />
          )
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
