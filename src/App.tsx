import { Suspense, lazy, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ConsentModal } from './components/ConsentModal';
import { StudentHome } from './components/StudentHome';
import { ProfileScreen } from './components/ProfileScreen';
import { LessonsScreen } from './components/LessonsScreen';
import { EventsScreen } from './components/EventsScreen';
import { GuidedTour } from './components/GuidedTour';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { clearPending, peekPending, PENDING_JOIN_KEY } from './lib/joinLink';
import { fetchBatchJoinPreview } from './lib/batchService';
import { formatDateDisplay } from './lib/dateUtils';
import type { BatchJoinPreview } from './types/database';
import { AlertCircle, Loader2, ArrowUpRight, Flame, BookOpen, CalendarDays, HeartHandshake, QrCode } from 'lucide-react';
import { BrandMark } from './components/BrandMark';

// Staff screens load only when opened, so students download less (Phase 15)
const AdminHome = lazy(() => import('./components/AdminHome').then((m) => ({ default: m.AdminHome })));
const TeacherHome = lazy(() => import('./components/TeacherHome').then((m) => ({ default: m.TeacherHome })));
const CrmScreen = lazy(() => import('./components/CrmScreen').then((m) => ({ default: m.CrmScreen })));

const ScreenLoading = () => (
  <div role="status" className="w-full flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
  </div>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.3 5.7c4.3-3.9 7-9.8 7-17.1z" />
    <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
  </svg>
);

type Tab = 'home' | 'lessons' | 'profile' | 'events' | 'leads';

function MainApp() {
  const { user, activeRole, setActiveRole, hasConsent, isLoading, organisation, notice, clearNotice } = useAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  // Batch QR scanned before sign-in: show which batch the person is joining
  const [pendingJoin, setPendingJoin] = useState<string | null>(() => peekPending(PENDING_JOIN_KEY));
  const [joinPreview, setJoinPreview] = useState<BatchJoinPreview | null | 'unknown'>(null);

  useEffect(() => {
    if (user || !pendingJoin) return;
    let cancelled = false;
    fetchBatchJoinPreview(pendingJoin)
      .then((p) => !cancelled && setJoinPreview(p || 'unknown'))
      .catch(() => !cancelled && setJoinPreview(null));
    return () => {
      cancelled = true;
    };
  }, [user, pendingJoin]);
  // The guided tour opens only from the ? button (Phase 14): never by itself, so it
  // can never cover the consent screen or appear for people it does not fit
  const [showTour, setShowTour] = useState(false);

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

  // Loading
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-[100dvh] items-center justify-center gap-4 text-stone-500">
        <BrandMark className="w-12 h-12 animate-float" />
        <span className="text-xs tracking-wide flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening {organisation.app_name}
        </span>
      </div>
    );
  }

  // Not signed in: white-label landing page
  if (!user) {
    const features = [
      { icon: Flame, title: 'Daily practice', text: 'One tap a day. Your streak and your 40-day trail.' },
      { icon: BookOpen, title: 'Learn', text: 'Short lessons that open as your programme unfolds.' },
      { icon: CalendarDays, title: 'Gather', text: 'Intro talks, satsangs and follow-ups in one place.' },
      { icon: HeartHandshake, title: 'Guided', text: 'Your teacher sees how you are doing and checks in.' },
    ];
    return (
      <div className="flex flex-col min-h-[100dvh] text-stone-900">
        <header className="sticky top-0 z-30 px-3 pt-3">
          <div className="ui-glass max-w-md mx-auto h-14 px-2 rounded-full flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {organisation.logo_url ? (
                <img src={organisation.logo_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <BrandMark className="w-9 h-9" />
              )}
              <span className="font-display font-semibold text-[15px]">{organisation.app_name}</span>
            </div>
            <button type="button" onClick={handleGoogleSignIn} className="h-9 px-4 rounded-full text-xs font-medium text-stone-700 hover:bg-stone-900/5 cursor-pointer transition-colors">
              Sign in
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-md md:max-w-5xl mx-auto px-4 md:px-10 pt-10 md:pt-20 pb-10 space-y-8 md:space-y-0 md:grid md:grid-cols-2 md:gap-16 md:items-center">
          <section className="text-center md:text-left space-y-5 animate-fade-up">
            <div className="relative mx-auto md:mx-0 w-28 h-28">
              <div className="absolute inset-0 rounded-full bg-emerald-400/30 blur-2xl" />
              <BrandMark className="relative w-28 h-28 animate-float drop-shadow-[0_18px_30px_rgba(24,24,27,0.25)]" />
            </div>
            <span className="ui-eyebrow">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {organisation.name}
            </span>
            <h1 className="font-display text-[2.6rem] md:text-6xl leading-[1.02] font-semibold text-stone-950">
              Your practice,
              <br />
              <span className="font-serif italic font-normal text-stone-500">gently kept.</span>
            </h1>
            <p className="text-[15px] md:text-lg text-stone-500 leading-relaxed max-w-[19rem] md:max-w-md mx-auto md:mx-0">
              {organisation.footer_text || 'Daily practice, programmes and teacher guidance for your community.'}
            </p>
          </section>

          <div className="space-y-8">
          {pendingJoin && (
            <section className="ui-card !p-4 space-y-2 animate-fade-up" role="status">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700">
                <QrCode className="w-3.5 h-3.5" /> You are joining a batch
              </div>
              {joinPreview && joinPreview !== 'unknown' ? (
                <div>
                  <div className="font-display text-lg font-semibold">{joinPreview.batch_name}</div>
                  <div className="text-xs text-stone-500">
                    {joinPreview.course_name}
                    {joinPreview.start_date ? ` · starts ${formatDateDisplay(joinPreview.start_date, organisation.timezone)}` : ''}
                  </div>
                </div>
              ) : joinPreview === 'unknown' ? (
                <div className="text-xs text-red-600">
                  The join code {pendingJoin} was not found. Please check the QR code with your teacher.
                </div>
              ) : (
                <div className="text-sm font-mono font-semibold">Join code {pendingJoin}</div>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-stone-500">Sign in with Google and you are added automatically.</p>
                <button
                  type="button"
                  onClick={() => {
                    clearPending(PENDING_JOIN_KEY);
                    setPendingJoin(null);
                  }}
                  className="text-[11px] text-stone-400 hover:text-stone-700 shrink-0 cursor-pointer"
                >
                  Not now
                </button>
              </div>
            </section>
          )}

          <section className="space-y-3 animate-fade-up [animation-delay:120ms]">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              className="group w-full ui-btn-primary !py-2 !pl-2 !pr-2 justify-between"
            >
              <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0">
                <GoogleIcon />
              </span>
              <span className="text-[15px]">
                {isSigningIn ? 'Connecting to Google...' : pendingJoin ? 'Continue with Google and join' : 'Continue with Google'}
              </span>
              <span className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-px">
                <ArrowUpRight className="w-4 h-4" />
              </span>
            </button>
            <p className="text-center text-[11px] text-stone-400">No password. No app store. Just your Google account.</p>
            {authError && (
              <div role="alert" className="p-3 bg-red-50 rounded-2xl text-xs text-red-600 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 gap-3 animate-fade-up [animation-delay:220ms]">
            {features.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className={`ui-card !p-4 space-y-2 ${i === 0 || i === 3 ? 'col-span-2 flex items-center gap-4 space-y-0' : ''}`}>
                <span className="w-9 h-9 rounded-full bg-stone-900/[0.04] flex items-center justify-center shrink-0">
                  <Icon className="w-[18px] h-[18px] text-stone-700" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-stone-900">{title}</div>
                  <div className="text-xs text-stone-500 leading-relaxed">{text}</div>
                </div>
              </div>
            ))}
          </section>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // Signed in
  return (
    <div className="flex flex-col min-h-[100dvh] text-stone-900 md:pl-64">
      {!hasConsent && <ConsentModal />}

      {/* Navigation Header */}
      <Header
        currentTab={currentTab}
        onNavigate={(tab) => setCurrentTab(tab as Tab)}
        activeRoleView={activeRole}
        onRoleSwitch={(newRole) => setActiveRole(newRole)}
        onOpenTour={() => setShowTour(true)}
      />

      {/* Interactive Guided Tour / Tooltips for First-Time Users */}
      <GuidedTour
        isOpen={showTour}
        onClose={() => {
          setShowTour(false);
          localStorage.setItem('sadhana_tour_completed', 'true');
        }}
        onShowPractice={() => {
          setActiveRole('student');
          setCurrentTab('home');
        }}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md md:max-w-3xl lg:max-w-4xl mx-auto px-4 md:px-8 pt-5 md:pt-10 pb-4 animate-fade-up">
        {notice && (
          <div
            role="status"
            className={`mb-4 p-3.5 rounded-2xl text-sm flex items-start justify-between gap-3 ring-1 ${
              notice.tone === 'success'
                ? 'bg-emerald-50 ring-emerald-600/15 text-emerald-900'
                : 'bg-red-50 ring-red-600/15 text-red-700'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={clearNotice} className="text-xs underline shrink-0 cursor-pointer">
              Close
            </button>
          </div>
        )}
        <Suspense fallback={<ScreenLoading />}>
        {currentTab === 'leads' ? (
          <CrmScreen onBack={() => setCurrentTab('home')} />
        ) : currentTab === 'events' ? (
          <EventsScreen onBack={() => setCurrentTab('home')} />
        ) : currentTab === 'profile' ? (
          <ProfileScreen onBack={() => setCurrentTab('home')} />
        ) : currentTab === 'lessons' ? (
          <LessonsScreen onBack={() => setCurrentTab('home')} />
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
        </Suspense>
      </main>

      <Footer withNav />
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
