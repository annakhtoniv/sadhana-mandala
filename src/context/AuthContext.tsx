import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { currentLang } from '../i18n/locale';
import { translate } from '../i18n';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchOrganisation, getResolvedOrgSlug, DEFAULT_ORGANISATION } from '../lib/organisation';
import { claimUserInvites, fetchUserEnrolments, joinBatchByCode } from '../lib/batchService';
import { pickDefaultEnrolment } from '../lib/programmeUtils';
import { checkInToEvent } from '../lib/eventService';
import { removeMyAvatarFiles, syncGoogleAvatar } from '../lib/avatarService';
import { friendlyError } from '../lib/errors';
import { PENDING_CHECKIN_KEY, PENDING_JOIN_KEY, readLinkParams, savePending, takePending } from '../lib/joinLink';
import { allowedRoleViews, defaultRoleView } from '../lib/roles';
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
  /** Saves consent in the database; only a successful save counts */
  giveConsent: () => Promise<{ success: boolean; error?: string }>;
  /** Deletes the account; on success the person is signed out */
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** After an admin saves the organisation settings */
  updateOrganisation: (org: Organisation) => void;
  refreshEnrolment: () => Promise<void>;
  joinBatch: (code: string) => Promise<{ success: boolean; message?: string }>;
  /** A one-off message for the user, e.g. the result of an event QR check-in */
  notice: { tone: 'success' | 'error'; text: string } | null;
  clearNotice: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A batch QR code opens the app with ?code=JOINCODE (older ones: ?join=), an
// event check-in QR with ?event=CHECKINCODE (Phase 8). Keep the code on the
// device across the Google sign-in redirect and use it once signed in.
// The programme a student last opened on this device
const SELECTED_ENROLMENT_KEY = 'sadhana_selected_enrolment';
// Version of the privacy text people agree to (stored with each consent)
export const CONSENT_NOTICE_VERSION = 'v2-2026-10';
// The 1-click demo login was removed on 2026-10-18: forget any demo session a
// browser still has, so everyone sees the real database.
try {
  localStorage.removeItem('sadhana_demo_session');
  localStorage.removeItem('sadhana_demo_enrolment');
  localStorage.removeItem('sadhana_demo_my_events');
} catch {
  // ignore (storage blocked)
}
try {
  const { joinCode, eventCode } = readLinkParams(window.location.search);
  if (joinCode) savePending(PENDING_JOIN_KEY, joinCode);
  if (eventCode) savePending(PENDING_CHECKIN_KEY, eventCode);
  if (joinCode || eventCode) window.history.replaceState(null, '', window.location.pathname);
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
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  // Good news goes away by itself after a few seconds; problems stay until closed
  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  // Active Role view (supports easy instant switching between Student, Teacher, and Admin)
  const [activeRole, setActiveRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('sadhana_active_role') as UserRole) || 'student';
  });

  const orgRef = useRef<Organisation>(DEFAULT_ORGANISATION);
  // The user whose profile is loaded (or loading), so the same sign-in is not loaded twice
  const loadedUserRef = useRef<string | null>(null);

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
    const view = savedView && allowedRoleViews(actualRole).includes(savedView) ? savedView : defaultRoleView(actualRole);
    setActiveRoleState(view);
    localStorage.setItem('sadhana_active_role', view);
  };

  const fetchProfileForUser = async (currentUser: User, activeOrg: Organisation) => {
    try {
      await claimUserInvites();

      // The profile row is created by the database on first sign-in (handle_new_user),
      // with the roles from role_grants. The client never chooses its own role.
      const readProfile = () => supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
      let { data: existingProfile, error } = await readProfile();

      if (error) {
        // Keep whatever was shown before (an admin stays admin after a network blip)
        setNotice({ tone: 'error', text: `${translate('auth.profileFailed')} ${friendlyError(error)}` });
        return;
      }

      // A brand-new member who signed in on another organisation's site joins that organisation
      if (existingProfile && activeOrg.id && (existingProfile as Profile).org_id !== activeOrg.id) {
        const { data: moved } = await supabase.rpc('adopt_site_organisation', { p_org_slug: activeOrg.slug });
        if (moved) ({ data: existingProfile, error } = await readProfile());
      }

      if (existingProfile) {
        const prof = existingProfile as Profile;
        setProfile(prof);
        applyRole(prof.role);
        // Phase 12: keep the Google photo up to date (unless the person uploaded their own)
        if (prof.avatar_source !== 'upload') {
          syncGoogleAvatar().then((url) => {
            if (url && url !== prof.avatar_url) setProfile((p) => (p ? { ...p, avatar_url: url, avatar_source: 'google' } : p));
          });
        }
      } else {
        // Profile not created yet (first seconds after sign-up): a student until it is
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

      // Batch QR: enrol the person in the scanned batch
      let joinedId: string | null = null;
      const pendingCode = takePending(PENDING_JOIN_KEY);
      if (pendingCode) {
        const res = await joinBatchByCode(pendingCode);
        if (res.success) {
          joinedId = res.data?.enrolment_id || null;
          if (joinedId) localStorage.setItem(SELECTED_ENROLMENT_KEY, joinedId);
          setNotice({
            tone: 'success',
            text: res.data?.batch_name ? translate('auth.joinedNamed', { batch: res.data.batch_name }) : translate('auth.joined'),
          });
        } else {
          setNotice({
            tone: 'error',
            text: translate('auth.joinFailed', { reason: res.message || '?' }),
          });
        }
      }

      await loadEnrolmentForUser(currentUser.id, joinedId);

      const pendingCheckin = takePending(PENDING_CHECKIN_KEY);
      if (pendingCheckin) {
        const res = await checkInToEvent(pendingCheckin);
        setNotice(
          res.success
            ? { tone: 'success', text: res.title ? translate('auth.eventCheckedInNamed', { title: res.title }) : translate('auth.eventCheckedIn') }
            : { tone: 'error', text: res.message || translate('auth.eventCheckinFailed') }
        );
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfileForUser(user, orgRef.current);
    }
  }, [user]);

  const updateOrganisation = useCallback((org: Organisation) => {
    orgRef.current = org;
    setOrganisation(org);
  }, []);

  const refreshEnrolment = useCallback(async () => {
    if (user) {
      await loadEnrolmentForUser(user.id);
    }
  }, [user]);

  const joinBatch = async (code: string) => {
    const res = await joinBatchByCode(code);
    if (res.success && user) {
      // Open the programme just joined (the RPC returns enrolment_id)
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
          setUser(initialSession.user);
          loadedUserRef.current = initialSession.user.id;
          await fetchProfileForUser(initialSession.user, loadedOrg);
        } else {
          setUser(null);
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

    // Only a new sign-in or a sign-out reloads the profile. A token refresh (hourly)
    // only updates the session. The work runs after the callback returns, so it
    // never waits inside the sign-in library's lock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, newSession) => {
      if (isCancelled) return;
      setSession(newSession);
      const newUser = newSession?.user ?? null;
      if (event === 'SIGNED_OUT' || !newUser) {
        loadedUserRef.current = null;
        setUser(null);
        setProfile(null);
        setEnrolments([]);
        setIsLoading(false);
        return;
      }
      setUser(newUser);
      if (event === 'SIGNED_IN' && loadedUserRef.current !== newUser.id) {
        loadedUserRef.current = newUser.id;
        setTimeout(() => {
          fetchProfileForUser(newUser, orgRef.current).finally(() => setIsLoading(false));
        }, 0);
      }
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Consent counts only once the database has recorded it (and the consent log has a row)
  const giveConsent = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Please sign in first.' };
    // The notice version records the language it was read in, e.g. v2-2026-10-ar
    const { data, error } = await supabase.rpc('give_user_consent', { p_notice_version: `${CONSENT_NOTICE_VERSION}-${currentLang()}` });
    if (error) return { success: false, error: friendlyError(error, 'Your consent could not be saved. Please try again.') };
    const at = (data as string) || new Date().toISOString();
    setProfile((prev) => (prev ? { ...prev, consent_at: at } : prev));
    return { success: true };
  };

  // Deletes photos, then the account (the database refuses for a teacher with
  // batches and for the last admin, with a message that says why)
  const deleteAccount = async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Please sign in first.' };
    const { error } = await supabase.rpc('delete_user_account');
    if (error) return { success: false, error: friendlyError(error, 'Your account could not be deleted. Please try again.') };
    await removeMyAvatarFiles(user.id);
    localStorage.removeItem('sadhana_active_role');
    loadedUserRef.current = null;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setEnrolments([]);
    return { success: true };
  };

  const signOut = async () => {
    localStorage.setItem('sadhana_signed_out', 'true');
    if (user) {
      localStorage.removeItem(`sadhana_consent_${user.id}`);
      localStorage.removeItem('sadhana_active_role');
      loadedUserRef.current = null;
      localStorage.removeItem('sadhana_demo_enrolment');
    }
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setEnrolments([]);
  };

  const role = profile?.role ?? activeRole;

  // Consent is what the database recorded, nothing else
  const hasConsent = Boolean(profile?.consent_at);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        enrolment,
        enrolments,
        selectEnrolment,
        notice,
        clearNotice: () => setNotice(null),
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
        updateOrganisation,
        refreshEnrolment,
        joinBatch,
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
