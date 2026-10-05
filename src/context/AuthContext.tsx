import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchOrganisation, getResolvedOrgSlug, DEFAULT_ORGANISATION } from '../lib/organisation';
import type { Organisation, Profile, UserRole } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organisation: Organisation;
  role: UserRole;
  hasConsent: boolean;
  isLoading: boolean;
  giveConsent: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organisation, setOrganisation] = useState<Organisation>(DEFAULT_ORGANISATION);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Keep a ref to the latest organisation to avoid dependency cycles in callbacks
  const orgRef = useRef<Organisation>(DEFAULT_ORGANISATION);

  const fetchProfileForUser = async (currentUser: User, activeOrg: Organisation) => {
    try {
      // 1. Fetch existing profile
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (existingProfile) {
        setProfile(existingProfile as Profile);
        return;
      }

      if (error && error.code !== 'PGRST116') {
        console.warn('Profiles query note:', error.message);
      }

      // 2. If table exists and has an org, try auto-creating if trigger didn't run
      if (activeOrg.id) {
        let assignedRole: UserRole = 'student';
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
          setProfile(insertedProfile as Profile);
          return;
        }
      }

      // Fallback in-memory profile if database table not yet migrated
      setProfile({
        id: currentUser.id,
        org_id: activeOrg.id,
        email: currentUser.email || '',
        full_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || null,
        role: 'student',
        consent_at: null,
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

  // Initialise Auth & Organization ONCE on mount
  useEffect(() => {
    let isCancelled = false;

    async function init() {
      try {
        // Step 1: Load organisation details
        const slug = getResolvedOrgSlug();
        const loadedOrg = await fetchOrganisation(slug);
        if (!isCancelled) {
          orgRef.current = loadedOrg;
          setOrganisation(loadedOrg);
        }

        // Step 2: Check Supabase session
        if (!isSupabaseConfigured) {
          if (!isCancelled) setIsLoading(false);
          return;
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (isCancelled) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          await fetchProfileForUser(initialSession.user, loadedOrg);
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

    // Step 3: Listen for auth state changes (sign in, sign out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (isCancelled) return;

      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);

      if (newUser) {
        await fetchProfileForUser(newUser, orgRef.current);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []); // Run ONCE on mount

  // Give consent
  const giveConsent = async () => {
    if (!user || !profile) return;
    const nowIso = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ consent_at: nowIso })
        .eq('id', user.id);

      if (error) {
        console.warn('Failed to update consent_at in profiles table:', error.message);
      }

      setProfile(prev => prev ? { ...prev, consent_at: nowIso } : null);
    } catch (err) {
      console.error('Error giving consent:', err);
    }
  };

  // Delete account
  const deleteAccount = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc('delete_user_account');
      if (error) {
        console.warn('delete_user_account RPC error, trying direct profile delete:', error.message);
        await supabase.from('profiles').delete().eq('id', user.id);
      }
    } catch (err) {
      console.error('Error deleting account:', err);
    } finally {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const role = profile?.role ?? 'student';
  const hasConsent = Boolean(profile?.consent_at);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        organisation,
        role,
        hasConsent,
        isLoading,
        giveConsent,
        deleteAccount,
        signOut,
        refreshProfile,
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
