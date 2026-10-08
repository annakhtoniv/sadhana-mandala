import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchOrganisation, getResolvedOrgSlug, DEFAULT_ORGANISATION } from '../lib/organisation';
import { claimUserInvites, fetchUserEnrolment, joinBatchByCode } from '../lib/batchService';
import { DEMO_ENROLMENT_VINOTH, DEMO_TEACHER_PROFILE } from '../lib/mockData';
import type { Organisation, Profile, UserRole, Enrolment } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  enrolment: Enrolment | null;
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(DEMO_ENROLMENT_VINOTH);
  const [organisation, setOrganisation] = useState<Organisation>(DEFAULT_ORGANISATION);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Role view (supports easy instant switching between Student, Teacher, and Admin)
  const [activeRole, setActiveRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('sadhana_active_role') as UserRole) || 'student';
  });

  const orgRef = useRef<Organisation>(DEFAULT_ORGANISATION);

  const loadEnrolmentForUser = async (userId: string) => {
    try {
      const activeEnrolment = await fetchUserEnrolment(userId);
      setEnrolment(activeEnrolment || DEMO_ENROLMENT_VINOTH);
    } catch (err) {
      console.error('Error loading enrolment:', err);
      setEnrolment(DEMO_ENROLMENT_VINOTH);
    }
  };

  const fetchProfileForUser = async (currentUser: User, activeOrg: Organisation) => {
    try {
      await claimUserInvites();
      await loadEnrolmentForUser(currentUser.id);

      // Check existing profile
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (existingProfile) {
        const prof = existingProfile as Profile;
        setProfile(prof);

        // Check if user has a stored role preference or use profile role
        const savedRole = localStorage.getItem('sadhana_active_role') as UserRole | null;
        if (!savedRole) {
          setActiveRoleState(prof.role);
          localStorage.setItem('sadhana_active_role', prof.role);
        }
        return;
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Profiles query note:', error.message);
      }

      // Check if user has an invite or pre-granted role
      let assignedRole: UserRole = (localStorage.getItem('sadhana_active_role') as UserRole) || 'student';
      if (activeOrg.id) {
        const { data: grant } = await supabase
          .from('role_grants')
          .select('role')
          .eq('org_id', activeOrg.id)
          .ilike('email', currentUser.email || '')
          .maybeSingle();

        if (grant?.role) {
          assignedRole = grant.role as UserRole;
        }

        const newProfileData = {
          id: currentUser.id,
          org_id: activeOrg.id,
          email: currentUser.email || '',
          full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '',
          role: assignedRole,
        };

        const { data: insertedProfile } = await supabase
          .from('profiles')
          .insert(newProfileData)
          .select('*')
          .maybeSingle();

        if (insertedProfile) {
          const prof = insertedProfile as Profile;
          setProfile(prof);
          setActiveRoleState(prof.role);
          return;
        }
      }

      // In-memory fallback
      setProfile({
        id: currentUser.id,
        org_id: activeOrg.id,
        email: currentUser.email || '',
        full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || null,
        role: assignedRole,
        consent_at: localStorage.getItem(`sadhana_consent_${currentUser.id}`) || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
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
      await loadEnrolmentForUser(user.id);
    }
    return res;
  };

  // Change active role (switches between Student, Teacher, Admin on the fly)
  const setActiveRole = async (newRole: UserRole) => {
    setActiveRoleState(newRole);
    localStorage.setItem('sadhana_active_role', newRole);

    // Also update profile in database if logged in
    if (user) {
      try {
        const { error: rpcError } = await supabase.rpc('set_my_role', { p_role: newRole });
        if (rpcError) {
          await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', user.id);
        }
        setProfile(prev => prev ? { ...prev, role: newRole } : null);
      } catch (err) {
        console.warn('Could not sync role change to database:', err);
      }
    }
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
          setUser(initialSession.user);
          await fetchProfileForUser(initialSession.user, loadedOrg);
        } else {
          // Check for saved demo session
          const savedDemo = localStorage.getItem('sadhana_demo_session');
          if (savedDemo) {
            try {
              const parsed = JSON.parse(savedDemo) as User;
              setUser(parsed);
              await fetchProfileForUser(parsed, loadedOrg);
            } catch {
              localStorage.removeItem('sadhana_demo_session');
              setUser(null);
            }
          } else if (!localStorage.getItem('sadhana_signed_out')) {
            // Auto-sign in demo session so PM / user immediately sees the populated app!
            const demoId = DEMO_TEACHER_PROFILE.id;
            const demoUser = {
              id: demoId,
              app_metadata: {},
              user_metadata: { full_name: 'Vinoth Rajaasekaran' },
              aud: 'authenticated',
              created_at: new Date().toISOString(),
              email: 'vinoth@sadhana.zyxenai.com',
            } as unknown as User;

            localStorage.setItem('sadhana_demo_session', JSON.stringify(demoUser));
            localStorage.setItem(`sadhana_consent_${demoId}`, new Date().toISOString());
            setUser(demoUser);
            await fetchProfileForUser(demoUser, loadedOrg);
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
        setUser(newUser);
        await fetchProfileForUser(newUser, orgRef.current);
      } else if (!localStorage.getItem('sadhana_demo_session')) {
        setUser(null);
        setProfile(null);
        setEnrolment(null);
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
    try {
      // First try calling RPC if available
      const { error: rpcErr } = await supabase.rpc('give_user_consent');
      if (rpcErr) {
        // Fallback to direct update
        await supabase
          .from('profiles')
          .update({ consent_at: nowIso })
          .eq('id', user.id);
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
      setEnrolment(null);
    }
  };

  // 1-Click Demo login for testing, PM preview, and embedded IDE preview
  const signInDemo = async (roleToUse: UserRole = 'student') => {
    setIsLoading(true);
    localStorage.removeItem('sadhana_signed_out');
    try {
      // Find real user profile first or use demo profile
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      const targetProfile = profiles?.find((p: Profile) => p.full_name?.toLowerCase().includes('vinoth')) || profiles?.[0];
      
      const demoId = targetProfile?.id || DEMO_TEACHER_PROFILE.id;
      const demoUser = {
        id: demoId,
        app_metadata: {},
        user_metadata: { full_name: targetProfile?.full_name || 'Vinoth Rajaasekaran' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        email: targetProfile?.email || 'vinoth@sadhana.zyxenai.com',
      } as unknown as User;

      localStorage.setItem('sadhana_demo_session', JSON.stringify(demoUser));
      localStorage.setItem('sadhana_active_role', roleToUse);
      localStorage.setItem(`sadhana_consent_${demoId}`, new Date().toISOString());

      setUser(demoUser);
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
      localStorage.removeItem('sadhana_demo_session');
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setEnrolment(null);
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
