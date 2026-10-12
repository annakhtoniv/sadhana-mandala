import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, isDemoMode, DEMO_SESSION_KEY } from '../lib/supabase';
import { fetchOrganisation, getResolvedOrgSlug, DEFAULT_ORGANISATION } from '../lib/organisation';
import { claimUserInvites, fetchUserEnrolments, joinBatchByCode } from '../lib/batchService';
import { pickDefaultEnrolment } from '../lib/programmeUtils';
import { DEMO_TEACHER_PROFILE } from '../lib/mockData';
import { allowedRoleViews } from '../lib/roles';
import type { Organisation, Profile, UserRole, Enrolment } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** The programme currently open on the student home */
  enrolment: Enrolment | null;
  /** Every programme the user is enrolled in, newest first */
  enrolments: Enrolment[];
  selectEnrolment: (enrolmentId: string) => void;
  organisation: Organisation;
  role: UserRole;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => Promise<void>;
  hasConsent: boolean;
  isLoading: boolean;
  giveConsent: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshEnrolment: () => Promise<void>;
  joinBatch: (code: string) => Promise<{ success: boolean; message?: string }>;
  signInDemo: (role?: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A batch QR code opens the app with ?code=JOINCODE. Keep the code across the
// Google sign-in redirect and join the batch once the user is signed in.
const PENDING_JOIN_KEY = 'sadhana_pending_join_code';
// The programme a student last opened on this device
const SELECTED_ENROLMENT_KEY = 'sadhana_selected_enrolment';
try {
  const codeFromUrl = new URLSearchParams(window.location.search).get('code');
  if (codeFromUrl) {
    sessionStorage.setItem(PENDING_JOIN_KEY, codeFromUrl.trim().toUpperCase());
    window.history.replaceState(null, '', window.location.pathname);
  }
} catch {
  // ignore (non-browser environment)
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [selectedEnrolmentId, setSelectedEnrolmentId] = useState<string | null>(null);
  const enrolment = enrolments.find((e) => e.id === selectedEnrolmentId) || null;
  const [organisation, setOrganisation] = useState<Organisation>(DEFAULT_ORGANISATION);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Role view (supports easy instant switching between Student, Teacher, and Admin)
  const [activeRole, setActiveRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('sadhana_active_role') as UserRole) || 'student';
  });

  const orgRef = useRef<Organisation>(DEFAULT_ORGANISATION);

  const loadEnrolmentForUser = async (userId: string, preferredId?: string | null) => {
    try {
      const list = await fetchUserEnrolments(userId);
      const chosen = pickDefaultEnrolment(
        list,
        orgRef.current.timezone,
        preferredId || localStorage.getItem(SELECTED_ENROLMENT_KEY)
      );
      setEnrolments(list);
      setSelectedEnrolmentId(chosen?.id ?? null);
    } catch (err) {
      console.error('Error loading enrolments:', err);
      setEnrolments([]);
      setSelectedEnrolmentId(null);
    }
  };

  const applyRole = (actualRole: UserRole) => {
    const savedView = localStorage.getItem('sadhana_active_role') as UserRole | null;
    const view = savedView && allowedRoleViews(actualRole).includes(savedView) ? savedView : actualRole;
    setActiveRoleState(view);
    localStorage.setItem('sadhana_active_role', view);
  };

  const fetchProfileForUser = async (currentUser: User, activeOrg: Organisation) => {
    // 1-click demo: sample data only, no database calls
    if (isDemoMode()) {
      setProfile({ ...DEMO_TEACHER_PROFILE, consent_at: localStorage.getItem(`sadhana_consent_${currentUser.id}`) });
      applyRole(DEMO_TEACHER_PROFILE.role);
      await loadEnrolmentForUser(currentUser.id);
      return;
    }

    try {
      await claimUserInvites();

      // The profile row is created by the database on first sign-in (handle_new_user),
      // with the role from role_grants. The client never chooses its own role.
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (error) {
        console.warn('Profiles query note:', error.message);
      }

      if (existingProfile) {
        const prof = existingProfile as Profile;
        setProfile(prof);
        applyRole(prof.role);
      } else {
        // Profile not readable yet: treat as a student until it is
        setProfile({
          id: currentUser.id,
          org_id: activeOrg.id,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '',
          role: 'student',
          consent_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        applyRole('student');
      }

      const pendingCode = sessionStorage.getItem(PENDING_JOIN_KEY);
      if (pendingCode) {
        sessionStorage.removeItem(PENDING_JOIN_KEY);
        const res = await joinBatchByCode(pendingCode);
        if (!res.success) {
          console.warn('Join from QR code failed:', res.message);
        }
      }

      await loadEnrolmentForUser(currentUser.id);
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfileForUser(user, orgRef.current);
    }
  }, [user]);

  const refreshEnrolment = useCallback(async () => {
    if (user) {
      await loadEnrolmentForUser(user.id);
    }
  }, [user]);

  const joinBatch = async (code: string) => {
    const res = await joinBatchByCode(code);
    if (res.success && user) {
      // Open the programme just joined (RPC returns enrolment_id; demo returns the enrolment)
      const joinedId: string | null = res.data?.enrolment_id || res.data?.id || null;
      if (joinedId) localStorage.setItem(SELECTED_ENROLMENT_KEY, joinedId);
      await loadEnrolmentForUser(user.id, joinedId);
    }
    return res;
  };

  const selectEnrolment = (enrolmentId: string) => {
    setSelectedEnrolmentId(enrolmentId);
    try {
      localStorage.setItem(SELECTED_ENROLMENT_KEY, enrolmentId);
    } catch {
      // ignore storage errors
    }
  };

  // Switch which home screen is shown. This is a view only: it never changes
  // the user's role in the database (SPEC: a user can never change their own role).
  const setActiveRole = async (newRole: UserRole) => {
    const actualRole = profile?.role ?? 'student';
    if (!allowedRoleViews(actualRole).includes(newRole)) return;
    setActiveRoleState(newRole);
    localStorage.setItem('sadhana_active_role', newRole);
  };

  // Initialise Auth & Organization ONCE on mount
  useEffect(() => {
    let isCancelled = false;

    async function init() {
      try {
        const slug = getResolvedOrgSlug();
        const loadedOrg = await fetchOrganisation(slug);
        if (!isCancelled) {
          orgRef.current = loadedOrg;
          setOrganisation(loadedOrg);
        }

        if (!isSupabaseConfigured) {
          if (!isCancelled) setIsLoading(false);
          return;
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (isCancelled) return;

        setSession(initialSession);

        if (initialSession?.user) {
          localStorage.removeItem(DEMO_SESSION_KEY);
          localStorage.removeItem('sadhana_demo_enrolment');
          setUser(initialSession.user);
          await fetchProfileForUser(initialSession.user, loadedOrg);
        } else {
          // Resume an explicit 1-click demo session, if one was started
          const savedDemo = localStorage.getItem(DEMO_SESSION_KEY);
          if (savedDemo) {
            try {
              const parsed = JSON.parse(savedDemo) as User;
              setUser(parsed);
              await fetchProfileForUser(parsed, loadedOrg);
            } catch {
              localStorage.removeItem(DEMO_SESSION_KEY);
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Error in auth initialization:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (isCancelled) return;

      setSession(newSession);
      const newUser = newSession?.user ?? null;

      if (newUser) {
        localStorage.removeItem(DEMO_SESSION_KEY);
        localStorage.removeItem('sadhana_demo_enrolment');
        setUser(newUser);
        await fetchProfileForUser(newUser, orgRef.current);
      } else if (!isDemoMode()) {
        setUser(null);
        setProfile(null);
        setEnrolments([]);
      }
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Give consent (Stores both in DB and localStorage for 100% reliable persistence across refreshes)
  const giveConsent = async () => {
    if (!user) return;
    const nowIso = new Date().toISOString();

    // 1. Immediately persist in localStorage so refresh NEVER prompts again
    localStorage.setItem(`sadhana_consent_${user.id}`, nowIso);

    // 2. Update local state
    setProfile(prev => (prev ? { ...prev, consent_at: nowIso } : null));

    // 3. Persist to database
    if (isDemoMode()) return;
    try {
      const { error: rpcErr } = await supabase.rpc('give_user_consent');
      if (rpcErr) {
        console.warn('Consent was not saved to the database:', rpcErr.message);
      }
    } catch (err) {
      console.warn('Database consent update note:', err);
    }
  };

  // Delete account
  const deleteAccount = async () => {
    if (!user) return;
    try {
      localStorage.removeItem(`sadhana_consent_${user.id}`);
      localStorage.removeItem('sadhana_active_role');
      await supabase.rpc('delete_user_account');
    } catch (err) {
      console.error('Error deleting account:', err);
    } finally {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setEnrolments([]);
    }
  };

  // 1-Click Demo login for testing, PM preview, and embedded IDE preview
  const signInDemo = async (roleToUse: UserRole = 'admin') => {
    setIsLoading(true);
    localStorage.removeItem('sadhana_signed_out');
    try {
      const demoId = DEMO_TEACHER_PROFILE.id;
      const demoUser = {
        id: demoId,
        app_metadata: {},
        user_metadata: { full_name: 'Vinoth Rajaasekaran' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: 'annakhtoniv@gmail.com',
      } as unknown as User;

      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(demoUser));
      localStorage.setItem('sadhana_active_role', roleToUse);
      localStorage.setItem(`sadhana_consent_${demoId}`, new Date().toISOString());

      setUser(demoUser);
      setProfile(DEMO_TEACHER_PROFILE);
      setActiveRoleState(roleToUse);
      await fetchProfileForUser(demoUser, orgRef.current);
    } catch (err) {
      console.error('Demo sign-in failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    localStorage.setItem('sadhana_signed_out', 'true');
    if (user) {
      localStorage.removeItem(`sadhana_consent_${user.id}`);
      localStorage.removeItem('sadhana_active_role');
      localStorage.removeItem(DEMO_SESSION_KEY);
      localStorage.removeItem('sadhana_demo_enrolment');
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setEnrolments([]);
  };

  const role = profile?.role ?? activeRole;

  // Consent is true if stored in profile OR backed up in localStorage
  const hasConsent = Boolean(
    profile?.consent_at ||
    (user?.id && localStorage.getItem(`sadhana_consent_${user.id}`))
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        enrolment,
        enrolments,
        selectEnrolment,
        organisation,
        role,
        activeRole,
        setActiveRole,
        hasConsent,
        isLoading,
        giveConsent,
        deleteAccount,
        signOut,
        refreshProfile,
        refreshEnrolment,
        joinBatch,
        signInDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
