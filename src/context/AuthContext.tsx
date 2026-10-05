import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  // Load organisation branding
  const loadOrganisation = useCallback(async () => {
    const slug = getResolvedOrgSlug();
    const org = await fetchOrganisation(slug);
    setOrganisation(org);
    return org;
  }, []);

  // Fetch or safely ensure profile exists in DB
  const loadUserProfile = useCallback(async (currentUser: User, activeOrg: Organisation) => {
    if (!currentUser) {
      setProfile(null);
      return;
    }

    try {
      // 1. Try to fetch existing profile
      const { data: existingProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (existingProfile) {
        setProfile(existingProfile as Profile);
        return;
      }

      // If table doesn't exist yet or query failed, handle gracefully
      if (error && error.code !== 'PGRST116') {
        console.warn('Could not read profiles table. Has schema.sql been run?', error.message);
      }

      // 2. Fallback: If profile doesn't exist yet and we have a valid org id in DB
      if (activeOrg.id) {
        // Check if user has a pre-granted role
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

      // Virtual fallback profile if database schema is not yet applied
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
      console.error('Error loading profile:', err);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadUserProfile(user, organisation);
    }
  }, [user, organisation, loadUserProfile]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setIsLoading(true);
      try {
        const org = await loadOrganisation();

        if (!isSupabaseConfigured) {
          if (mounted) setIsLoading(false);
          return;
        }

        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }

        if (initialSession?.user) {
          await loadUserProfile(initialSession.user, org);
        }
      } catch (err) {
        console.error('Error during auth initialization:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await loadUserProfile(newSession.user, organisation);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadOrganisation, loadUserProfile, organisation]);

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
      // Calls server-side security definer RPC function that deletes user from auth.users
      const { error } = await supabase.rpc('delete_user_account');
      if (error) {
        console.warn('RPC delete_user_account not found or failed, falling back to profile delete:', error.message);
        await supabase.from('profiles').delete().eq('id', user.id);
      }
    } catch (err) {
      console.error('Error during account deletion:', err);
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
