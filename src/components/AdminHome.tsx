import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProgrammesManager } from './ProgrammesManager';
import { BatchSharePanel } from './BatchSharePanel';
import { TeacherBatchDetail } from './TeacherBatchDetail';
import { BatchCard, batchPhase } from './BatchCard';
import { Avatar } from './Avatar';
import { supabase } from '../lib/supabase';
import { fetchAllPages } from '../lib/paging';
import { friendlyError } from '../lib/errors';
import { FunnelReportPanel } from './FunnelReportPanel';
import { ClientErrorsPanel } from './ClientErrorsPanel';
import { hasRole, rolesOf, primaryRole, ROLE_LABEL } from '../lib/roles';
import { RolePicker } from './RolePicker';
import { OrganisationSettings } from './OrganisationSettings';
import {
  fetchCourses,
  fetchTeacherBatches,
  createBatch,
} from '../lib/batchService';
import {
  getTodayInTimezone,
} from '../lib/dateUtils';
import type { Profile, RoleGrant, UserRole, Course, Batch } from '../types/database';
import {
  UserPlus,
  Settings,
  Check,
  Trash2,
  RefreshCw,
  BookOpen,
  PlusCircle,
  Users,
  Calendar,
  Search,
  X,
  BarChart3,
} from 'lucide-react';

export const AdminHome: React.FC = () => {
  const { organisation, profile: currentProfile, refreshProfile, updateOrganisation } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'users' | 'courses' | 'reports'>('batches');
  const [showSettings, setShowSettings] = useState(false);

  // Loading & general status
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Users & Roles state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleGrants, setRoleGrants] = useState<RoleGrant[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRoles, setNewRoles] = useState<UserRole[]>(['teacher']);
  const [peopleSearch, setPeopleSearch] = useState('');

  // Courses state
  const [courses, setCourses] = useState<Course[]>([]);

  // All Batches state
  const [allBatches, setAllBatches] = useState<Batch[]>([]);
  const [batchSearch, setBatchSearch] = useState('');

  // Create Batch Modal State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchCourseId, setBatchCourseId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [batchStartDate, setBatchStartDate] = useState('');
  const [batchTeacherId, setBatchTeacherId] = useState('');
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // QR & Share Modal State
  const [qrBatch, setQrBatch] = useState<Batch | null>(null);
  // Batch opened from the Batches tab (roster, edit, QR)
  const [openBatch, setOpenBatch] = useState<Batch | null>(null);

  const loadData = async () => {
    if (!organisation.id) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      // Everyone in the organisation, page by page (Supabase returns at most 1,000 rows per request)
      const allProfiles = fetchAllPages<Profile>((from, to) =>
        supabase.from('profiles').select('*').eq('org_id', organisation.id).order('id', { ascending: true }).range(from, to)
      )
        .then((data) => ({ data, error: null as { message: string } | null }))
        .catch((err: Error) => ({ data: null as Profile[] | null, error: { message: err.message } }));
      const [profsRes, grantsRes, courseList, batchList] = await Promise.all([
        allProfiles,
        supabase.from('role_grants').select('*').eq('org_id', organisation.id),
        fetchCourses(organisation.id),
        fetchTeacherBatches('', true),
      ]);

      if (profsRes.error) throw new Error(profsRes.error.message);
      const list = (profsRes.data as Profile[]) || [];
      // You first, then by role and name
      const rank: Record<UserRole, number> = { admin: 0, teacher: 1, volunteer: 2, student: 3 };
      list.sort((a, b) =>
        a.id === currentProfile?.id ? -1 : b.id === currentProfile?.id ? 1
          : rank[a.role] - rank[b.role] || (a.full_name || a.email).localeCompare(b.full_name || b.email)
      );
      setProfiles(list);

      if (grantsRes.data) setRoleGrants(grantsRes.data as RoleGrant[]);
      setCourses(courseList);
      setAllBatches(batchList);

      if (!batchCourseId && courseList[0]) {
        setBatchCourseId(courseList[0].id);
      }
      if (!batchStartDate) {
        setBatchStartDate(getTodayInTimezone(organisation.timezone));
      }
      if (!batchTeacherId) {
        setBatchTeacherId(currentProfile?.id || '');
      }
    } catch (err) {
      setStatusMessage(`Could not load data: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation.id]);

  // Handle Role Grant
  const handleAddRoleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !organisation.id) return;

    setStatusMessage(null);
    const normalizedEmail = newEmail.trim().toLowerCase();

    try {
      const { error: grantErr } = await supabase
        .from('role_grants')
        .upsert(
          {
            org_id: organisation.id,
            email: normalizedEmail,
            role: primaryRole(newRoles),
            roles: newRoles,
          },
          { onConflict: 'org_id,email' }
        );

      if (grantErr) throw grantErr;

      // Update existing profile if present
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ roles: newRoles })
        .eq('org_id', organisation.id)
        .ilike('email', normalizedEmail);
      if (profErr) throw profErr;

      setStatusMessage(`Saved: ${newRoles.map((r) => ROLE_LABEL[r]).join(', ')} for ${normalizedEmail}`);
      setNewEmail('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save role grant';
      setStatusMessage(`Error: ${msg}`);
    }
  };

  // Handle Remove Role Grant
  const handleDeleteRoleGrant = async (grantId: string) => {
    try {
      const { error } = await supabase.from('role_grants').delete().eq('id', grantId);
      if (error) {
        setStatusMessage(`Error: ${friendlyError(error)}`);
        return;
      }
      await loadData();
    } catch (err) {
      console.error('Failed to remove role grant:', err);
    }
  };

  // Handle Quick Role Change on existing profile
  // Several roles per person (Phase 13); errors are shown by the role picker
  const handleProfileRolesChange = async (profileId: string, roles: UserRole[]) => {
    const { error } = await supabase.from('profiles').update({ roles }).eq('id', profileId);
    if (error) throw new Error(error.message);
    setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, roles, role: primaryRole(roles) } : p)));
    if (profileId === currentProfile?.id) await refreshProfile();
  };

  // Handle Create Batch (Admin Modal)
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName.trim()) {
      setBatchError('Please enter a cohort batch name');
      return;
    }

    setIsCreatingBatch(true);
    setBatchError(null);

    // Never fall back to made-up ids: without a programme or teacher the batch is not created
    const courseIdToUse = batchCourseId || courses[0]?.id || '';
    const teacherIdToUse = batchTeacherId || currentProfile?.id || '';
    const orgIdToUse = organisation.id;
    if (!courseIdToUse || !teacherIdToUse || !orgIdToUse) {
      setBatchError('Please choose a programme and a teacher first.');
      return;
    }
    const startDateToUse = batchStartDate || getTodayInTimezone(organisation.timezone);

    const result = await createBatch({
      orgId: orgIdToUse,
      courseId: courseIdToUse,
      teacherId: teacherIdToUse,
      name: batchName.trim(),
      startDate: startDateToUse,
    });

    if (result.success && result.data) {
      const newBatch = result.data;
      setShowBatchModal(false);
      setBatchName('');
      // Optimistically prepend to all batches
      setAllBatches((prev) => [newBatch, ...prev.filter((b) => b.id !== newBatch.id)]);
      setActiveTab('batches');
    } else {
      setBatchError(result.error || 'Failed to create cohort batch. Please try again.');
    }
    setIsCreatingBatch(false);
  };


  // Metrics for Sanctuary KPI Grid
  const withRole = (r: UserRole) => profiles.filter((p) => rolesOf(p).includes(r)).length;
  const studentCount = withRole('student');
  const teacherCount = withRole('teacher');
  const volunteerCount = withRole('volunteer');
  // Invitations for people who have not signed in yet (signed-in people are under Everyone)
  const signedInEmails = new Set(profiles.map((p) => p.email.toLowerCase()));
  const waitingGrants = roleGrants.filter((g) => !signedInEmails.has(g.email.toLowerCase()));
  const peopleQuery = peopleSearch.trim().toLowerCase();
  const filteredPeople = peopleQuery
    ? profiles.filter((p) =>
        [p.full_name || '', p.email, ...rolesOf(p).map((r) => ROLE_LABEL[r])].some((t) => t.toLowerCase().includes(peopleQuery))
      )
    : profiles;
  const filteredBatches = allBatches.filter((b) =>
    b.name.toLowerCase().includes(batchSearch.toLowerCase()) ||
    b.join_code.toLowerCase().includes(batchSearch.toLowerCase()) ||
    (b.course?.name && b.course.name.toLowerCase().includes(batchSearch.toLowerCase()))
  );

  const openNewBatch = () => {
    setBatchName('');
    setBatchError(null);
    setShowBatchModal(true);
  };

  const runningBatches = allBatches.filter((b) => batchPhase(b, organisation.timezone) === 'running').length;

  // The overview cards are also the section switch (no separate tab bar)
  const sections = [
    { id: 'batches' as const, label: 'Batches', value: allBatches.length, icon: Calendar, note: `${runningBatches} running now` },
    {
      id: 'users' as const,
      label: 'People',
      value: profiles.length,
      icon: Users,
      note: `${studentCount} students · ${teacherCount} teachers · ${volunteerCount} volunteers`,
    },
    { id: 'courses' as const, label: 'Programmes', value: courses.length, icon: BookOpen, note: 'in the catalogue' },
    { id: 'reports' as const, label: 'Reports', value: null, icon: BarChart3, note: 'Leads and journey' },
  ];

  if (openBatch) {
    return (
      <TeacherBatchDetail
        batch={openBatch}
        organisation={organisation}
        canChangeTeacher
        backLabel="Back to Admin"
        onBatchUpdated={(updated) => {
          setOpenBatch(updated);
          setAllBatches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        }}
        onBack={() => {
          setOpenBatch(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="w-full space-y-6 pb-6">
      {/* Title */}
      <section className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="ui-eyebrow">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Admin · {organisation.name}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={loadData} disabled={loading} className="ui-icon-btn" title="Refresh" aria-label="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="ui-icon-btn"
              title="Organisation settings"
              aria-label="Organisation settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
        <h1 className="font-display text-[2rem] leading-[1.05] font-semibold text-stone-950">
          Overview
          <span className="font-display italic font-normal text-stone-400"> of your community</span>
        </h1>
      </section>

      {/* Overview cards: tap one to open that section */}
      <nav aria-label="Admin sections" className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {sections.map(({ id, label, value, icon: Icon, note }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`ui-card !p-4 text-left cursor-pointer transition-all hover:-translate-y-0.5 ${active ? '!bg-stone-950 text-white' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase tracking-[0.16em] font-medium ${active ? 'text-white/60' : 'text-stone-500'}`}>{label}</span>
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-stone-400'}`} />
              </div>
              <div className={`font-display text-3xl font-semibold mt-2 ${active ? 'text-white' : 'text-stone-950'}`}>
                {value ?? <BarChart3 className="w-7 h-7 my-0.5" />}
              </div>
              <div className={`text-[11px] mt-0.5 leading-snug ${active ? 'text-white/55' : 'text-stone-400'}`}>{note}</div>
            </button>
          );
        })}
      </nav>

      {/* 5. TAB CONTENT: BATCHES & COHORTS */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* Action & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search batches, programmes or join codes"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-3 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={openNewBatch}
              className="ui-btn-primary !py-2.5 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>New batch</span>
            </button>
          </div>

          {/* Cohorts Grid */}
          {filteredBatches.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-stone-200 text-center space-y-3">
              <Calendar className="w-8 h-8 text-stone-500 mx-auto opacity-50" />
              <p className="text-xs text-stone-500">
                {batchSearch ? 'No batches match.' : 'No batches yet.'}
              </p>
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 rounded-2xl bg-stone-900 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create the first batch</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {(['running', 'upcoming', 'finished'] as const).map((phase) => {
                const list = filteredBatches
                  .filter((b) => batchPhase(b, organisation.timezone) === phase)
                  .sort((x, y) => (phase === 'upcoming' ? x.start_date.localeCompare(y.start_date) : y.start_date.localeCompare(x.start_date)));
                if (list.length === 0) return null;
                return (
                  <section key={phase} className="space-y-2.5">
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
                      {phase === 'running' ? 'Running' : phase === 'upcoming' ? 'Starting soon' : 'Finished'}{' '}
                      <span className="text-stone-400 tabular-nums">{list.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {list.map((batch) => (
                        <BatchCard
                          key={batch.id}
                          batch={batch}
                          timeZone={organisation.timezone}
                          onOpen={() => setOpenBatch(batch)}
                          onShowQr={() => setQrBatch(batch)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. TAB CONTENT: USERS & ROLE ASSIGNMENTS */}
      {activeTab === 'users' && (
        <div className="space-y-5">
          {/* Pre-Grant Role Form */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-600" />
              <h2 className="font-display text-base font-bold text-stone-900">
                Give someone a role
              </h2>
            </div>
            <p className="text-xs text-stone-500">
              Give one or more roles to an email in advance (for example Teacher and Volunteer). When the person signs in with Google, the roles are active at once. If they already use the app, their roles change now.
            </p>

            <form onSubmit={handleAddRoleGrant} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <input
                    type="email"
                    required
                    placeholder="teacher.name@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="flex items-center sm:justify-end">
                  <RolePicker value={newRoles} onChange={setNewRoles} label="Roles to give" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {statusMessage ? (
                  <span className="text-xs text-emerald-600 font-semibold">{statusMessage}</span>
                ) : (
                  <span className="text-[11px] text-stone-500">
                    Active at their first Google sign-in.
                  </span>
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-stone-900 text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save roles</span>
                </button>
              </div>
            </form>
          </div>

          {/* Pre-Granted Roles Directory */}
          {waitingGrants.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Waiting for first sign-in ({waitingGrants.length})
              </h3>
              <div className="divide-y divide-stone-100">
                {waitingGrants.map((grant) => (
                  <div key={grant.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-stone-900">{grant.email}</div>
                      <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                        Roles: {rolesOf(grant).map((r) => ROLE_LABEL[r]).join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoleGrant(grant.id)}
                      className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                      title="Delete pre-grant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Profiles Directory */}
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-stone-900">
                Everyone ({peopleQuery ? `${filteredPeople.length} of ${profiles.length}` : profiles.length})
              </h3>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Search by name, email or role"
                aria-label="Search people"
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              {peopleSearch && (
                <button type="button" onClick={() => setPeopleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 ui-icon-btn !w-7 !h-7" aria-label="Clear search">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {peopleQuery && filteredPeople.length === 0 && (
              <p className="text-xs text-stone-500 py-2">Nobody matches "{peopleSearch.trim()}".</p>
            )}

            <div className="divide-y divide-stone-100">
              {filteredPeople.map((p) => {

                const isCurrent = p.id === currentProfile?.id;

                return (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={p.full_name || p.email} url={p.avatar_url} size={36} />

                      <div className="min-w-0">
                        <div className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                          <span>{p.full_name || 'Student'}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-600">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 truncate">{p.email}</div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <RolePicker
                        value={rolesOf(p)}
                        onChange={(roles) => handleProfileRolesChange(p.id, roles)}
                        locked={isCurrent ? { admin: 'You cannot remove your own admin role' } : {}}
                        label={`Roles of ${p.full_name || p.email}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 7. TAB CONTENT: COURSE CURRICULA */}
      {activeTab === 'courses' && <ProgrammesManager />}

      {/* Phase 10: funnel report */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          <FunnelReportPanel />
          <ClientErrorsPanel timeZone={organisation.timezone} />
        </div>
      )}

      {/* Organisation settings (gear icon) */}
      {showSettings && (
        <OrganisationSettings organisation={organisation} onClose={() => setShowSettings(false)} onSaved={updateOrganisation} />
      )}

      {/* 9. CREATE BATCH MODAL (Fixed for Admin) */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-stone-900">
                  New batch
                </span>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Create a batch
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-full text-stone-500 hover:text-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5">
              {/* Select Course */}
              <div>
                <label className="block text-xs font-semibold text-stone-900 mb-1">
                  Programme
                </label>
                <select
                  value={batchCourseId || courses[0]?.id || ''}
                  onChange={(e) => setBatchCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none cursor-pointer"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.duration_days} days)
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Name */}
              <div>
                <label className="block text-xs font-semibold text-stone-900 mb-1">
                  Batch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. November Dawn Sadhana"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              {/* Teacher Assign */}
              <div>
                <label className="block text-xs font-semibold text-stone-900 mb-1">
                  Teacher
                </label>
                <select
                  value={batchTeacherId || currentProfile?.id || ''}
                  onChange={(e) => setBatchTeacherId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none cursor-pointer"
                >
                  {profiles
                    .filter((p) => hasRole(p, 'teacher') || hasRole(p, 'admin'))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email} ({t.role}){t.id === currentProfile?.id ? ' - you' : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-stone-900 mb-1">
                  Start Date (Day 1 in {organisation.timezone})
                </label>
                <input
                  type="date"
                  required
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none cursor-pointer"
                />
              </div>

              {batchError && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
                  {batchError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBatch || !batchName.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCreatingBatch ? 'Creating...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. BATCH QR CODE SHARING MODAL */}
      {qrBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-stone-200 p-6 shadow-2xl space-y-4 text-center">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-900">
                Batch QR
              </span>
              <button
                type="button"
                onClick={() => setQrBatch(null)}
                className="p-1 rounded-full text-stone-500 hover:text-stone-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-display text-lg font-bold text-stone-900">
              {qrBatch.name}
            </h3>

            <p className="text-xs text-stone-500">{qrBatch.course?.name}</p>

            <div className="text-left">
              <BatchSharePanel
                batchName={qrBatch.name}
                courseName={qrBatch.course?.name || ''}
                joinCode={qrBatch.join_code}
                appName={organisation.app_name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
