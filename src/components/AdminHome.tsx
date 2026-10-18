import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ProgrammesManager } from './ProgrammesManager';
import { BatchSharePanel } from './BatchSharePanel';
import { supabase, isDemoMode } from '../lib/supabase';
import { FunnelReportPanel } from './FunnelReportPanel';
import { ROLE_LABEL } from '../lib/roles';
import {
  fetchCourses,
  fetchTeacherBatches,
  createBatch,
} from '../lib/batchService';
import {
  DEMO_TEACHER_PROFILE,
  DEMO_ROSTER_STUDENTS,
  DEMO_COURSE_40,
  DEMO_COURSE_21,
  DEMO_ORG_ID,
} from '../lib/mockData';
import {
  formatDateDisplay,
  calculateDayNumber,
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
  Copy,
  QrCode,
  GraduationCap,
  ArrowRight,
  Search,
  X,
  BarChart3,
} from 'lucide-react';

export const AdminHome: React.FC = () => {
  const { organisation, profile: currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'users' | 'courses' | 'reports' | 'system'>('batches');

  // Loading & general status
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Users & Roles state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleGrants, setRoleGrants] = useState<RoleGrant[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher');

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
  const [batchCustomCode, setBatchCustomCode] = useState('');
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // QR & Share Modal State
  const [qrBatch, setQrBatch] = useState<Batch | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadData = async () => {
    if (!organisation.id) return;
    setLoading(true);
    setStatusMessage(null);
    try {
      const [profsRes, grantsRes, courseList, batchList] = await Promise.all([
        supabase.from('profiles').select('*').eq('org_id', organisation.id),
        supabase.from('role_grants').select('*').eq('org_id', organisation.id),
        fetchCourses(organisation.id),
        fetchTeacherBatches('', true),
      ]);

      // Sample data only in the 1-click demo; a real sign-in shows the database or an error
      if (isDemoMode()) {
        setProfiles([currentProfile || DEMO_TEACHER_PROFILE, ...DEMO_ROSTER_STUDENTS]);
      } else {
        if (profsRes.error) throw new Error(profsRes.error.message);
        const list = (profsRes.data as Profile[]) || [];
        // You first, then by role and name
        const rank: Record<UserRole, number> = { admin: 0, teacher: 1, volunteer: 2, student: 3 };
        list.sort((a, b) =>
          a.id === currentProfile?.id ? -1 : b.id === currentProfile?.id ? 1
            : rank[a.role] - rank[b.role] || (a.full_name || a.email).localeCompare(b.full_name || b.email)
        );
        setProfiles(list);
      }

      const safeCourses = courseList.length > 0 || !isDemoMode() ? courseList : [DEMO_COURSE_40, DEMO_COURSE_21];
      if (grantsRes.data) setRoleGrants(grantsRes.data as RoleGrant[]);
      setCourses(safeCourses);
      setAllBatches(batchList);

      if (!batchCourseId && safeCourses[0]) {
        setBatchCourseId(safeCourses[0].id);
      }
      if (!batchStartDate) {
        setBatchStartDate(getTodayInTimezone(organisation.timezone));
      }
      if (!batchTeacherId) {
        setBatchTeacherId(currentProfile?.id || DEMO_TEACHER_PROFILE.id);
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
            role: newRole,
          },
          { onConflict: 'org_id,email' }
        );

      if (grantErr) throw grantErr;

      // Update existing profile if present
      await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('org_id', organisation.id)
        .ilike('email', normalizedEmail);

      setStatusMessage(`Granted role "${newRole}" to ${normalizedEmail}`);
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
      await supabase.from('role_grants').delete().eq('id', grantId);
      await loadData();
    } catch (err) {
      console.error('Failed to remove role grant:', err);
    }
  };

  // Handle Quick Role Change on existing profile
  const handleProfileRoleChange = async (profileId: string, updatedRole: UserRole) => {
    try {
      await supabase
        .from('profiles')
        .update({ role: updatedRole })
        .eq('id', profileId);

      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, role: updatedRole } : p))
      );
    } catch (err) {
      console.error('Failed to change role:', err);
    }
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

    const availableCourses = courses.length > 0 ? courses : [DEMO_COURSE_40, DEMO_COURSE_21];
    const courseIdToUse = batchCourseId || availableCourses[0]?.id || DEMO_COURSE_40.id;
    const teacherIdToUse = batchTeacherId || currentProfile?.id || DEMO_TEACHER_PROFILE.id;
    const orgIdToUse = organisation.id || DEMO_ORG_ID;
    const startDateToUse = batchStartDate || getTodayInTimezone(organisation.timezone);

    const result = await createBatch({
      orgId: orgIdToUse,
      courseId: courseIdToUse,
      teacherId: teacherIdToUse,
      name: batchName.trim(),
      startDate: startDateToUse,
      joinCode: batchCustomCode.trim() ? batchCustomCode.trim().toUpperCase() : undefined,
    });

    if (result.success && result.data) {
      const newBatch = result.data;
      setShowBatchModal(false);
      setBatchName('');
      setBatchCustomCode('');
      // Optimistically prepend to all batches
      setAllBatches((prev) => [newBatch, ...prev.filter((b) => b.id !== newBatch.id)]);
      setActiveTab('batches');
    } else {
      setBatchError(result.error || 'Failed to create cohort batch. Please try again.');
    }
    setIsCreatingBatch(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // Metrics for Sanctuary KPI Grid
  const studentCount = profiles.filter((p) => p.role === 'student' || p.role === 'volunteer').length;
  const teacherCount = profiles.filter((p) => p.role === 'teacher' || p.role === 'admin').length;
  const volunteerCount = profiles.filter((p) => p.role === 'volunteer').length;
  const filteredBatches = allBatches.filter((b) =>
    b.name.toLowerCase().includes(batchSearch.toLowerCase()) ||
    b.join_code.toLowerCase().includes(batchSearch.toLowerCase()) ||
    (b.course?.name && b.course.name.toLowerCase().includes(batchSearch.toLowerCase()))
  );

  const openNewBatch = () => {
    setBatchName('');
    setBatchCustomCode('');
    setBatchError(null);
    setShowBatchModal(true);
  };

  const tabs = [
    { id: 'batches' as const, label: 'Batches', icon: Calendar, count: allBatches.length },
    { id: 'users' as const, label: 'People', icon: Users, count: profiles.length },
    { id: 'courses' as const, label: 'Programmes', icon: BookOpen, count: courses.length },
    { id: 'reports' as const, label: 'Reports', icon: BarChart3 },
    { id: 'system' as const, label: 'Settings', icon: Settings },
  ];

  const stats = [
    { label: 'Students', value: studentCount, icon: Users },
    { label: 'Batches', value: allBatches.length, icon: Calendar, note: 'running and finished' },
    { label: 'Programmes', value: courses.length, icon: BookOpen, note: 'in the catalogue' },
    { label: 'Teachers', value: teacherCount, icon: GraduationCap, note: `${volunteerCount} volunteer${volunteerCount === 1 ? '' : 's'}` },
  ];

  return (
    <div className="w-full space-y-6 pb-6">
      {/* Title */}
      <section className="pt-2 space-y-3">
        <div className="flex items-center justify-between">
          <span className="ui-eyebrow">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Admin · {organisation.name}
          </span>
          <button type="button" onClick={loadData} disabled={loading} className="ui-icon-btn" title="Refresh" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="font-display text-[2rem] leading-[1.05] font-semibold text-stone-950">
          Overview
          <span className="font-display italic font-normal text-stone-400"> of your community</span>
        </h1>
      </section>

      {/* Stats bento */}
      <section className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, note }, i) => (
          <div key={label} className={`ui-card !p-4 ${i === 0 ? 'bg-stone-950 text-white' : ''}`} style={i === 0 ? { background: '#09090b' } : undefined}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase tracking-[0.16em] font-medium ${i === 0 ? 'text-white/60' : 'text-stone-500'}`}>{label}</span>
              <Icon className={`w-4 h-4 ${i === 0 ? 'text-emerald-400' : 'text-stone-400'}`} />
            </div>
            <div className={`font-display text-3xl font-semibold mt-2 ${i === 0 ? 'text-white' : 'text-stone-950'}`}>{value}</div>
            <div className={`text-[11px] mt-0.5 ${i === 0 ? 'text-white/50' : 'text-stone-400'}`}>{note || 'incl. volunteers'}</div>
          </div>
        ))}
      </section>

      {/* Quick actions */}
      <section className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={openNewBatch} className="group ui-btn-primary !justify-between !pl-5 !pr-1.5 !py-1.5">
          <span>New batch</span>
          <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-px">
            <PlusCircle className="w-4 h-4" />
          </span>
        </button>
        <button type="button" onClick={() => setActiveTab('users')} className="group ui-btn-ghost !justify-between !pl-5 !pr-1.5 !py-1.5">
          <span>Add a role</span>
          <span className="w-9 h-9 rounded-full bg-stone-900/5 flex items-center justify-center transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-px">
            <ArrowRight className="w-4 h-4" />
          </span>
        </button>
      </section>

      {/* Tabs */}
      <nav aria-label="Admin sections" className="-mx-4 px-4 overflow-x-auto">
        <div className="inline-flex gap-1 p-1 rounded-full bg-stone-900/[0.04] ring-1 ring-stone-900/5">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`shrink-0 whitespace-nowrap h-9 px-3.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === id ? 'bg-white text-stone-950 shadow-[0_1px_2px_rgba(24,24,27,0.08),0_0_0_1px_rgba(24,24,27,0.06)]' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              {count !== undefined && <span className="text-stone-400 tabular-nums">{count}</span>}
            </button>
          ))}
        </div>
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
              onClick={() => {
                setBatchName('');
                setBatchCustomCode('');
                setBatchError(null);
                setShowBatchModal(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-stone-900 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer hover:opacity-90 shrink-0"
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredBatches.map((batch) => {
                const currentDay = calculateDayNumber(batch.start_date, organisation.timezone);
                const totalDays = batch.course?.duration_days || 40;
                const progressPct = Math.min(100, Math.max(0, Math.round((currentDay / totalDays) * 100)));

                return (
                  <div
                    key={batch.id}
                    className="bg-white p-4.5 rounded-2xl border border-stone-200 shadow-xs hover:border-stone-300 transition-all space-y-3.5"
                  >
                    {/* Top row: Name & Active Day */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9.5px] uppercase font-mono font-bold tracking-wider text-stone-900">
                          {batch.course?.name || 'Programme'}
                        </span>
                        <h3 className="font-display text-base font-bold text-stone-900 leading-snug">
                          {batch.name}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2.5 py-1 rounded-full bg-stone-900/10 text-stone-900 text-[10px] font-bold font-mono">
                          Day {currentDay > 0 ? currentDay : 1} of {totalDays}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-stone-800 to-emerald-500 transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-stone-500">
                        <span>Starts {formatDateDisplay(batch.start_date, organisation.timezone)}</span>
                        <span>{progressPct}% completed</span>
                      </div>
                    </div>

                    {/* Meta & Join Code Action Row */}
                    <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-xs">
                      {/* Teacher Attribution */}
                      <div className="flex items-center gap-1.5 text-stone-500">
                        <GraduationCap className="w-3.5 h-3.5 text-stone-900" />
                        <span className="text-[11px] truncate max-w-[120px]">
                          {batch.teacher?.full_name || batch.teacher?.email || 'Teacher'}
                        </span>
                      </div>

                      {/* Join Code & QR trigger */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(batch.join_code)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-stone-50 text-stone-900 font-mono font-bold text-[11px] border border-stone-200 hover:bg-stone-100 transition-all cursor-pointer"
                          title="Click to copy join code"
                        >
                          {copiedCode === batch.join_code ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">COPIED</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{batch.join_code}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setQrBatch(batch)}
                          className="p-1.5 rounded-xl bg-stone-50 text-stone-900 border border-stone-200 hover:bg-stone-100 transition-all cursor-pointer"
                          title="View QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
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
              Give a teacher, volunteer or admin role to an email in advance. When the person signs in with Google, the role is active at once. Volunteers use the Leads screen for their own leads.
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

                <div>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none cursor-pointer"
                  >
                    <option value="teacher">Teacher (batches)</option>
                    <option value="volunteer">Volunteer (leads)</option>
                    <option value="admin">Admin (everything)</option>
                    <option value="student">Student</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {statusMessage ? (
                  <span className="text-xs text-emerald-600 font-semibold">{statusMessage}</span>
                ) : (
                  <span className="text-[11px] text-stone-500">
                    Auto-claimed on first OAuth sign-in.
                  </span>
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-stone-900 text-white text-xs font-bold shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save role</span>
                </button>
              </div>
            </form>
          </div>

          {/* Pre-Granted Roles Directory */}
          {roleGrants.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Waiting for first sign-in ({roleGrants.length})
              </h3>
              <div className="divide-y divide-stone-100">
                {roleGrants.map((grant) => (
                  <div key={grant.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-stone-900">{grant.email}</div>
                      <div className="text-[10px] text-stone-500 uppercase tracking-wide">
                        Role: {grant.role}
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
                Everyone ({profiles.length})
              </h3>
              <span className="text-[11px] text-stone-500">
                Live database records
              </span>
            </div>

            <div className="divide-y divide-stone-100">
              {profiles.map((p) => {
                const initials = (p.full_name || p.email)
                  .split(' ')
                  .map((w) => w[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();

                const isCurrent = p.id === currentProfile?.id;

                return (
                  <div key={p.id} className="py-3 flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Initials Avatar */}
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-stone-800 to-stone-600 text-emerald-600 font-mono font-bold flex items-center justify-center shrink-0 text-xs shadow-xs">
                        {initials}
                      </div>

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

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={p.role}
                        onChange={(e) => handleProfileRoleChange(p.id, e.target.value as UserRole)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider border cursor-pointer ${
                          p.role === 'admin'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : p.role === 'teacher'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : p.role === 'volunteer'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300/50'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        {(['student', 'volunteer', 'teacher', 'admin'] as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
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
      {activeTab === 'reports' && <FunnelReportPanel />}

      {/* 8. TAB CONTENT: SYSTEM & GOVERNANCE PARAMETERS */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-stone-900" />
              <h2 className="font-display text-base font-bold text-stone-900">
                Organisation settings
              </h2>
            </div>
            <p className="text-xs text-stone-500">
              Core branding and operational settings configured for {organisation.name}.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-mono font-bold tracking-wider">
                  App Name
                </span>
                <span className="font-bold text-stone-900 text-sm">
                  {organisation.app_name}
                </span>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-mono font-bold tracking-wider">
                  Timezone
                </span>
                <span className="font-bold text-stone-900 text-sm">
                  {organisation.timezone}
                </span>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-mono font-bold tracking-wider">
                  Slug
                </span>
                <span className="font-bold text-stone-900 text-sm font-mono">
                  {organisation.slug}
                </span>
              </div>

              <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <span className="text-stone-500 block text-[10px] uppercase font-mono font-bold tracking-wider">
                  Powered by ZYXENAI
                </span>
                <span className="font-bold text-emerald-600 text-sm">
                  {organisation.show_powered_by ? 'Active (White-label footer)' : 'Hidden'}
                </span>
              </div>
            </div>
          </div>
        </div>
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
                  value={batchCourseId || (courses.length > 0 ? courses[0].id : DEMO_COURSE_40.id)}
                  onChange={(e) => setBatchCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none cursor-pointer"
                >
                  {(courses.length > 0 ? courses : [DEMO_COURSE_40, DEMO_COURSE_21]).map((c) => (
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
                  value={batchTeacherId || (currentProfile?.id || DEMO_TEACHER_PROFILE.id)}
                  onChange={(e) => setBatchTeacherId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs text-stone-900 focus:outline-none cursor-pointer"
                >
                  {isDemoMode() && (
                    <option value={DEMO_TEACHER_PROFILE.id}>{DEMO_TEACHER_PROFILE.full_name} (admin)</option>
                  )}
                  {profiles
                    .filter((p) => (p.role === 'teacher' || p.role === 'admin') && !(isDemoMode() && p.id === DEMO_TEACHER_PROFILE.id))
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

              {/* Custom Join Code */}
              <div>
                <label className="block text-xs font-semibold text-stone-900 mb-1">
                  Custom Join Code (Optional, max 8 chars)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Auto-generated if empty"
                  value={batchCustomCode}
                  onChange={(e) => setBatchCustomCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 bg-stone-50 text-xs font-mono uppercase tracking-wider text-stone-900 focus:outline-none"
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
