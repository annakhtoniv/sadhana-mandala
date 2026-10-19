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
import { hasRole, rolesOf, primaryRole, ROLE_LABEL, ROLE_HINT, ALL_ROLES } from '../lib/roles';
import { RolePicker } from './RolePicker';
import { OrganisationSettings } from './OrganisationSettings';
import { Sheet } from './Sheet';
import {
  fetchCourses,
  fetchTeacherBatches,
  createBatch,
} from '../lib/batchService';
import {
  getTodayInTimezone,
} from '../lib/dateUtils';
import { defaultBatchEndDate } from '../lib/programmeUtils';
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

/** People are listed 50 at a time so long lists stay quick on a phone. */
const PEOPLE_PAGE = 50;

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
  const [peopleFilter, setPeopleFilter] = useState<UserRole | 'all' | 'pending'>('all');
  const [peopleShown, setPeopleShown] = useState(PEOPLE_PAGE);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [savingGrant, setSavingGrant] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);

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
  // Empty: the programme's usual last day (Phase 20)
  const [batchEndDate, setBatchEndDate] = useState('');
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
    setGrantError(null);
    setSavingGrant(true);
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

      setNewEmail('');
      setShowAddPerson(false);
      // Reloading clears the message, so say "saved" after it
      await loadData();
      setStatusMessage(`Saved: ${newRoles.map((r) => ROLE_LABEL[r]).join(', ')} for ${normalizedEmail}`);
    } catch (err: unknown) {
      setGrantError(friendlyError(err as Error, 'The roles could not be saved. Please try again.'));
    } finally {
      setSavingGrant(false);
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
      setBatchError('Please enter a batch name.');
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
      endDate: batchEndDate || defaultBatchEndDate(courses.find((c) => c.id === courseIdToUse), startDateToUse),
    });

    if (result.success && result.data) {
      const newBatch = result.data;
      setShowBatchModal(false);
      setBatchName('');
      setBatchEndDate('');
      // Optimistically prepend to all batches
      setAllBatches((prev) => [newBatch, ...prev.filter((b) => b.id !== newBatch.id)]);
      setActiveTab('batches');
    } else {
      setBatchError(result.error || 'The batch could not be created. Please try again.');
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
  const roleFiltered = peopleFilter === 'all' || peopleFilter === 'pending' ? profiles : profiles.filter((p) => rolesOf(p).includes(peopleFilter));
  const filteredPeople = peopleQuery
    ? roleFiltered.filter((p) =>
        [p.full_name || '', p.email, ...rolesOf(p).map((r) => ROLE_LABEL[r])].some((t) => t.toLowerCase().includes(peopleQuery))
      )
    : roleFiltered;
  const filteredGrants = peopleQuery ? waitingGrants.filter((g) => g.email.toLowerCase().includes(peopleQuery)) : waitingGrants;
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
          <span className="font-display italic font-normal text-stone-500"> of your community</span>
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
                <span className={`text-xs uppercase tracking-[0.16em] font-medium ${active ? 'text-white/60' : 'text-stone-500'}`}>{label}</span>
                <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-stone-500'}`} />
              </div>
              <div className={`font-display text-3xl font-semibold mt-2 ${active ? 'text-white' : 'text-stone-950'}`}>
                {value ?? <BarChart3 className="w-7 h-7 my-0.5" />}
              </div>
              <div className={`text-xs mt-0.5 leading-snug ${active ? 'text-white/55' : 'text-stone-500'}`}>{note}</div>
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
                className="w-full ps-9 pe-4 py-2.5 rounded-2xl bg-white border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <Search className="w-4 h-4 text-stone-500 absolute start-3 top-3 pointer-events-none" />
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
                    <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
                      {phase === 'running' ? 'Running' : phase === 'upcoming' ? 'Starting soon' : 'Finished'}{' '}
                      <span className="text-stone-500 tabular-nums">{list.length}</span>
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

      {/* 6. PEOPLE: everyone in the organisation and their roles */}
      {activeTab === 'users' && (
        <section className="ui-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold text-stone-950">People</h2>
            <button
              type="button"
              onClick={() => {
                setGrantError(null);
                setShowAddPerson(true);
              }}
              className="ui-btn-primary"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add a person</span>
            </button>
          </div>
          {statusMessage && (
            <p
              role="status"
              className={`p-3 rounded-xl text-sm ${/^(Error|Could not)/.test(statusMessage) ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-900'}`}
            >
              {statusMessage}
            </p>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-stone-500 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={peopleSearch}
              onChange={(e) => {
                setPeopleSearch(e.target.value);
                setPeopleShown(PEOPLE_PAGE);
              }}
              placeholder="Search by name or email"
              aria-label="Search people"
              className="ui-input ps-10 pe-12"
            />
            {peopleSearch && (
              <button type="button" onClick={() => setPeopleSearch('')} className="absolute end-0.5 top-1/2 -translate-y-1/2 ui-icon-btn" aria-label="Clear search">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div role="group" aria-label="Show" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {(
              [
                ['all', 'Everyone', profiles.length],
                ['admin', 'Admins', withRole('admin')],
                ['teacher', 'Teachers', teacherCount],
                ['volunteer', 'Volunteers', volunteerCount],
                ['student', 'Students', studentCount],
                ['pending', 'Not signed in yet', waitingGrants.length],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                aria-pressed={peopleFilter === value}
                onClick={() => {
                  setPeopleFilter(value);
                  setPeopleShown(PEOPLE_PAGE);
                }}
                className={`shrink-0 min-h-10 px-3.5 rounded-full text-sm font-semibold cursor-pointer ring-1 ${
                  peopleFilter === value ? 'bg-stone-900 text-white ring-stone-900' : 'bg-white ring-stone-300 text-stone-700'
                }`}
              >
                {label} {count}
              </button>
            ))}
          </div>

          {peopleFilter === 'pending' ? (
            filteredGrants.length === 0 ? (
              <p className="text-base text-stone-600 py-2">
                {peopleQuery ? `Nobody matches "${peopleSearch.trim()}".` : 'Everyone you added has signed in.'}
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {filteredGrants.map((grant) => (
                  <li key={grant.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-base font-semibold text-stone-900 truncate">{grant.email}</div>
                      <div className="text-sm text-stone-600">{rolesOf(grant).map((r) => ROLE_LABEL[r]).join(', ')}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoleGrant(grant.id)}
                      className="ui-icon-btn hover:!text-red-700 shrink-0"
                      aria-label={`Remove the invitation for ${grant.email}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              {filteredPeople.length === 0 && (
                <p className="text-base text-stone-600 py-2">{peopleQuery ? `Nobody matches "${peopleSearch.trim()}".` : 'Nobody here yet.'}</p>
              )}
              <ul className="divide-y divide-stone-100">
                {filteredPeople.slice(0, peopleShown).map((p) => {
                  const isCurrent = p.id === currentProfile?.id;
                  return (
                    <li key={p.id} className="py-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={p.full_name || p.email} url={p.avatar_url} frame={p.avatar_frame} size={40} />
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-stone-900 truncate flex items-center gap-1.5">
                            <span dir="auto" className="truncate user-text">{p.full_name || p.email}</span>
                            {isCurrent && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 shrink-0">You</span>}
                          </div>
                          <div className="text-sm text-stone-600 truncate">{p.email}</div>
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
                    </li>
                  );
                })}
              </ul>
              {filteredPeople.length > peopleShown && (
                <button type="button" onClick={() => setPeopleShown((n) => n + PEOPLE_PAGE)} className="ui-btn-ghost w-full">
                  Show more ({filteredPeople.length - peopleShown} left)
                </button>
              )}
            </>
          )}
        </section>
      )}

      <Sheet
        open={showAddPerson}
        onClose={() => setShowAddPerson(false)}
        title="Add a person"
        description="Give roles to an email address. They are active as soon as the person signs in with Google. If they already use the app, their roles change now."
        busy={savingGrant}
        footer={
          <>
            <button type="button" onClick={() => setShowAddPerson(false)} className="ui-btn-ghost">
              Cancel
            </button>
            <button type="submit" form="add-person" disabled={savingGrant || !newEmail.trim()} className="ui-btn-primary">
              <Check className="w-4 h-4" />
              {savingGrant ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <form id="add-person" onSubmit={handleAddRoleGrant} className="space-y-4">
          <div>
            <label className="ui-label" htmlFor="add-person-email">Email address (their Google account)</label>
            <input
              id="add-person-email"
              type="email"
              required
              autoComplete="off"
              placeholder="name@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="ui-input"
            />
          </div>
          <fieldset>
            <legend className="ui-label">Roles</legend>
            <div className="space-y-2">
              {ALL_ROLES.map((r) => {
                const on = newRoles.includes(r);
                return (
                  <label key={r} className={`flex items-start gap-3 p-3 rounded-2xl ring-1 cursor-pointer ${on ? 'ring-emerald-600 bg-emerald-50' : 'ring-stone-200'}`}>
                    <input
                      type="checkbox"
                      className="mt-1 w-5 h-5 accent-emerald-700"
                      checked={on}
                      onChange={() =>
                        setNewRoles((cur) => (on ? (cur.length > 1 ? cur.filter((x) => x !== r) : cur) : ALL_ROLES.filter((x) => x === r || cur.includes(x))))
                      }
                    />
                    <span>
                      <span className="block text-base font-semibold text-stone-900">{ROLE_LABEL[r]}</span>
                      <span className="block text-sm text-stone-600">{ROLE_HINT[r]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {grantError && (
            <p role="alert" className="text-sm text-red-700">
              {grantError}
            </p>
          )}
        </form>
      </Sheet>

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

      <Sheet
        open={showBatchModal}
        onClose={() => setShowBatchModal(false)}
        title="New batch"
        description="A group of students who do a programme together."
        busy={isCreatingBatch}
        footer={
          <>
            <button type="button" onClick={() => setShowBatchModal(false)} className="ui-btn-ghost">
              Cancel
            </button>
            <button type="submit" form="admin-create-batch" disabled={isCreatingBatch || !batchName.trim()} className="ui-btn-primary">
              {isCreatingBatch ? 'Creating...' : 'Create batch'}
            </button>
          </>
        }
      >
        <form id="admin-create-batch" onSubmit={handleCreateBatch} className="space-y-4">
          <div>
            <label className="ui-label" htmlFor="acb-course">Programme</label>
            <select
              id="acb-course"
              value={batchCourseId || courses[0]?.id || ''}
              onChange={(e) => setBatchCourseId(e.target.value)}
              className="ui-input cursor-pointer"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.duration_days ? ` (${c.duration_days} days)` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="ui-label" htmlFor="acb-name">Batch name</label>
            <input
              id="acb-name"
              type="text"
              required
              maxLength={100}
              placeholder="For example: November mornings"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="ui-input"
            />
          </div>
          <div>
            <label className="ui-label" htmlFor="acb-teacher">Teacher</label>
            <select
              id="acb-teacher"
              value={batchTeacherId || currentProfile?.id || ''}
              onChange={(e) => setBatchTeacherId(e.target.value)}
              className="ui-input cursor-pointer"
            >
              {profiles
                .filter((p) => hasRole(p, 'teacher') || hasRole(p, 'admin'))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name || t.email}
                    {t.id === currentProfile?.id ? ' (you)' : ''}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="ui-label" htmlFor="acb-start">First day</label>
              <input
                id="acb-start"
                type="date"
                required
                value={batchStartDate}
                onChange={(e) => setBatchStartDate(e.target.value)}
                className="ui-input cursor-pointer"
              />
            </div>
            <div>
              <label className="ui-label" htmlFor="acb-end">Last day</label>
              <input
                id="acb-end"
                type="date"
                required
                min={batchStartDate}
                value={batchEndDate || defaultBatchEndDate(courses.find((c) => c.id === (batchCourseId || courses[0]?.id)), batchStartDate)}
                onChange={(e) => setBatchEndDate(e.target.value)}
                className="ui-input cursor-pointer"
              />
            </div>
          </div>
          <p className="text-xs text-stone-500 -mt-1">The last day follows the programme's length; change it if this batch is different.</p>
          {batchError && (
            <p role="alert" className="text-sm text-red-700">
              {batchError}
            </p>
          )}
        </form>
      </Sheet>

      <Sheet open={qrBatch !== null} onClose={() => setQrBatch(null)} title={qrBatch?.name || ''} description={qrBatch?.course?.name}>
        {qrBatch && (
          <BatchSharePanel
            batchName={qrBatch.name}
            courseName={qrBatch.course?.name || ''}
            joinCode={qrBatch.join_code}
            appName={organisation.app_name}
          />
        )}
      </Sheet>
    </div>
  );
};
