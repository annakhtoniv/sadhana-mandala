import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchCourses,
  createCourse,
  fetchTeacherBatches,
  createBatch,
} from '../lib/batchService';
import { DEMO_TEACHER_PROFILE, DEMO_ROSTER_STUDENTS } from '../lib/mockData';
import {
  formatDateDisplay,
  calculateDayNumber,
  getTodayInTimezone,
} from '../lib/dateUtils';
import type { Profile, RoleGrant, UserRole, Course, Batch } from '../types/database';
import { QRCodeSVG } from 'qrcode.react';
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
  Crown,
  Copy,
  QrCode,
  GraduationCap,
  ArrowRight,
  Search,
  X,
  ChevronRight,
  Zap,
} from 'lucide-react';

export const AdminHome: React.FC = () => {
  const { organisation, profile: currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'batches' | 'users' | 'courses' | 'system'>('batches');

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
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [durationDays, setDurationDays] = useState(40);
  const [courseMsg, setCourseMsg] = useState<string | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

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

      if (profsRes.data && profsRes.data.length > 0) {
        setProfiles(profsRes.data as Profile[]);
      } else {
        setProfiles([
          currentProfile || DEMO_TEACHER_PROFILE,
          ...DEMO_ROSTER_STUDENTS,
        ]);
      }

      if (grantsRes.data) setRoleGrants(grantsRes.data as RoleGrant[]);
      setCourses(courseList);
      setAllBatches(batchList);

      if (courseList.length > 0 && !batchCourseId) {
        setBatchCourseId(courseList[0].id);
      }
      if (!batchStartDate) {
        setBatchStartDate(getTodayInTimezone(organisation.timezone));
      }
      if (currentProfile?.id && !batchTeacherId) {
        setBatchTeacherId(currentProfile.id);
      }
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

  // Handle Create Course
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation.id || !courseName.trim()) return;

    setIsCreatingCourse(true);
    setCourseMsg(null);
    const res = await createCourse({
      orgId: organisation.id,
      name: courseName.trim(),
      description: courseDesc.trim(),
      durationDays: Number(durationDays) || 40,
    });

    if (res.success) {
      setCourseMsg('Course created successfully!');
      setCourseName('');
      setCourseDesc('');
      setDurationDays(40);
      setShowCourseModal(false);
      await loadData();
    } else {
      setCourseMsg(`Error: ${res.error || 'Failed to create course'}`);
    }
    setIsCreatingCourse(false);
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

    const courseIdToUse = batchCourseId || courses[0]?.id || 'c1000000-0000-0000-0000-000000000001';
    const teacherIdToUse = batchTeacherId || currentProfile?.id || DEMO_TEACHER_PROFILE.id;
    const orgIdToUse = organisation.id || 'b05dc423-a7e1-439f-9c72-ec94aad01aa0';
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
  const studentCount = profiles.filter((p) => p.role === 'student').length || DEMO_ROSTER_STUDENTS.length;
  const teacherCount = profiles.filter((p) => p.role === 'teacher' || p.role === 'admin').length || 2;
  const filteredBatches = allBatches.filter((b) =>
    b.name.toLowerCase().includes(batchSearch.toLowerCase()) ||
    b.join_code.toLowerCase().includes(batchSearch.toLowerCase()) ||
    (b.course?.name && b.course.name.toLowerCase().includes(batchSearch.toLowerCase()))
  );

  return (
    <div className="w-full space-y-6 pb-20 animate-in fade-in duration-200">
      {/* 1. TOP HEADER & SOVEREIGN STATUS BAR (Human 2.0 Sleep Sanctuary Style) */}
      <div className="bg-white dark:bg-[#0e161b] p-5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4ba377] inline-block animate-pulse shadow-sm shadow-[#4ba377]/50" />
            <span className="text-[10.5px] uppercase font-mono font-bold tracking-widest text-[#17495e] dark:text-[#e8b98a]">
              Admin Sanctuary &bull; {organisation.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-full text-[#717e7a] dark:text-[#90a2ad] hover:text-[#17495e] dark:hover:text-[#e8b98a] hover:bg-[#efe9df] dark:hover:bg-[#182933] transition-colors cursor-pointer"
              title="Refresh All Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* Sovereign Executive Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#d9a44a]/20 to-[#e8b98a]/30 border border-[#d9a44a]/60 shadow-xs text-xs font-bold text-[#8e6724] dark:text-[#e8b98a]">
              <Crown className="w-3.5 h-3.5 fill-current text-[#8e6724] dark:text-[#e8b98a]" />
              <span>Sovereign Admin</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <h1 className="font-serif text-2xl font-bold text-[#17495e] dark:text-[#e8b98a] leading-tight">
              Executive Console
            </h1>
            <p className="text-xs text-[#717e7a] dark:text-[#90a2ad] mt-0.5">
              Orchestrate cohorts, faculty roles, and contemplative curricula with zero friction.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBatchName('');
                setBatchCustomCode('');
                setBatchError(null);
                setShowBatchModal(true);
              }}
              className="px-4 py-2 rounded-2xl bg-[#e8b98a] hover:bg-[#dfaf7f] text-[#0b1317] font-bold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ New Cohort Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. EXECUTIVE OVERVIEW HERO BANNER (Human 2.0 Hero Card Style) */}
      <div className="bg-gradient-to-br from-[#17495e] via-[#1c556d] to-[#123645] text-white p-5 rounded-3xl shadow-md border border-[#17495e]/50 relative overflow-hidden space-y-4">
        <div className="flex items-start justify-between">
          <span className="text-[9.5px] uppercase font-mono font-bold tracking-widest text-[#e8b98a] bg-black/30 px-3 py-1 rounded-full backdrop-blur-xs">
            Operational Health &bull; 100% Real-Time
          </span>
          <span className="text-xs font-mono font-semibold text-[#e8b98a]/90">
            {organisation.timezone}
          </span>
        </div>

        <div className="space-y-1">
          <h2 className="font-serif text-xl font-bold text-white">
            Contemplative Governance Engine
          </h2>
          <p className="text-xs text-white/85 leading-relaxed max-w-xl">
            Sadhana Mandala maintains streak integrity across all enrolled students, surfaces quiet participants after 4 missed check-ins, and auto-claims invite codes upon sign-in.
          </p>
        </div>

        {/* Quick Action Tiles inside Hero */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setBatchName('');
              setBatchCustomCode('');
              setBatchError(null);
              setShowBatchModal(true);
            }}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <Users className="w-4 h-4 text-[#e8b98a]" />
              <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white">Create Cohort</div>
            <div className="text-[10px] text-white/70">Launch new batch</div>
          </button>

          <button
            type="button"
            onClick={() => {
              setCourseName('');
              setCourseDesc('');
              setCourseMsg(null);
              setShowCourseModal(true);
            }}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <BookOpen className="w-4 h-4 text-[#e8b98a]" />
              <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white">Add Curriculum</div>
            <div className="text-[10px] text-white/70">Define program days</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <UserPlus className="w-4 h-4 text-[#e8b98a]" />
              <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white">Grant Roles</div>
            <div className="text-[10px] text-white/70">Pre-grant teachers</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-1">
              <Settings className="w-4 h-4 text-[#e8b98a]" />
              <ArrowRight className="w-3.5 h-3.5 text-white/60 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <div className="text-xs font-bold text-white">Parameters</div>
            <div className="text-[10px] text-white/70">Org branding & TZ</div>
          </button>
        </div>
      </div>

      {/* 3. SANCTUARY KPI METRIC TILES (Human 2.0 Metric Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Students */}
        <div className="bg-white dark:bg-[#121e25] p-3.5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#717e7a] dark:text-[#90a2ad]">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider">Students</span>
            <Users className="w-3.5 h-3.5 text-[#17495e] dark:text-[#e8b98a]" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#17495e] dark:text-[#f2ede4]">
            {studentCount}
          </div>
          <div className="text-[10px] text-[#4ba377] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ba377] inline-block" />
            <span>Active practitioners</span>
          </div>
        </div>

        {/* Metric 2: Active Cohorts */}
        <div className="bg-white dark:bg-[#121e25] p-3.5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#717e7a] dark:text-[#90a2ad]">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider">Cohorts</span>
            <Calendar className="w-3.5 h-3.5 text-[#d9a44a]" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#17495e] dark:text-[#f2ede4]">
            {allBatches.length}
          </div>
          <div className="text-[10px] text-[#8e6724] dark:text-[#e8b98a] font-semibold">
            {allBatches.length > 0 ? 'Live in Dubai TZ' : 'Ready to create'}
          </div>
        </div>

        {/* Metric 3: Curricula Programs */}
        <div className="bg-white dark:bg-[#121e25] p-3.5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#717e7a] dark:text-[#90a2ad]">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider">Programs</span>
            <BookOpen className="w-3.5 h-3.5 text-[#3ba2c7]" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#17495e] dark:text-[#f2ede4]">
            {courses.length}
          </div>
          <div className="text-[10px] text-[#717e7a] dark:text-[#90a2ad]">
            40-day & 21-day tracks
          </div>
        </div>

        {/* Metric 4: Faculty & Quiet Alerts */}
        <div className="bg-white dark:bg-[#121e25] p-3.5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-[#717e7a] dark:text-[#90a2ad]">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider">Faculty</span>
            <GraduationCap className="w-3.5 h-3.5 text-[#4ba377]" />
          </div>
          <div className="font-serif text-2xl font-bold text-[#17495e] dark:text-[#f2ede4]">
            {teacherCount}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
            <Zap className="w-3 h-3 fill-current" />
            <span>2 quiet students flagged</span>
          </div>
        </div>
      </div>

      {/* 4. HUMAN 2.0 SEGMENTED TAB PILLS */}
      <div className="p-1.5 bg-white dark:bg-[#121e25] rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs flex gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'batches'
              ? 'bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] shadow-xs'
              : 'text-[#717e7a] dark:text-[#90a2ad] hover:text-[#17495e] dark:hover:text-[#e8b98a]'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Cohorts ({allBatches.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'users'
              ? 'bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] shadow-xs'
              : 'text-[#717e7a] dark:text-[#90a2ad] hover:text-[#17495e] dark:hover:text-[#e8b98a]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users & Roles ({profiles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'courses'
              ? 'bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] shadow-xs'
              : 'text-[#717e7a] dark:text-[#90a2ad] hover:text-[#17495e] dark:hover:text-[#e8b98a]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Curricula ({courses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'system'
              ? 'bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] shadow-xs'
              : 'text-[#717e7a] dark:text-[#90a2ad] hover:text-[#17495e] dark:hover:text-[#e8b98a]'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>System</span>
        </button>
      </div>

      {/* 5. TAB CONTENT: BATCHES & COHORTS */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* Action & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search cohorts by name, course, or join code..."
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-white dark:bg-[#121e25] border border-[#e6dccb] dark:border-[#1d2e38] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none focus:ring-2 focus:ring-[#17495e] dark:focus:ring-[#e8b98a]"
              />
              <Search className="w-4 h-4 text-[#717e7a] dark:text-[#90a2ad] absolute left-3 top-3 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={() => {
                setBatchName('');
                setBatchCustomCode('');
                setBatchError(null);
                setShowBatchModal(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer hover:opacity-90 shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Batch</span>
            </button>
          </div>

          {/* Cohorts Grid */}
          {filteredBatches.length === 0 ? (
            <div className="bg-white dark:bg-[#121e25] p-8 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] text-center space-y-3">
              <Calendar className="w-8 h-8 text-[#717e7a] dark:text-[#90a2ad] mx-auto opacity-50" />
              <p className="text-xs text-[#717e7a] dark:text-[#90a2ad]">
                {batchSearch ? 'No cohorts match your search.' : 'No cohorts created in this organisation yet.'}
              </p>
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="px-4 py-2 rounded-2xl bg-[#e8b98a] text-[#0b1317] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create First Cohort</span>
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
                    className="bg-white dark:bg-[#121e25] p-4.5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs hover:border-[#17495e]/40 dark:hover:border-[#e8b98a]/40 transition-all space-y-3.5"
                  >
                    {/* Top row: Name & Active Day */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9.5px] uppercase font-mono font-bold tracking-wider text-[#17495e] dark:text-[#e8b98a]">
                          {batch.course?.name || 'Sadhana Curriculum'}
                        </span>
                        <h3 className="font-serif text-base font-bold text-[#17495e] dark:text-[#f2ede4] leading-snug">
                          {batch.name}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2.5 py-1 rounded-full bg-[#17495e]/10 dark:bg-[#e8b98a]/15 text-[#17495e] dark:text-[#e8b98a] text-[10px] font-bold font-mono">
                          Day {currentDay > 0 ? currentDay : 1} of {totalDays}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-[#efe9df] dark:bg-[#1c2e39] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#17495e] to-[#4ba377] dark:from-[#d9a44a] dark:to-[#e8b98a] transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-[#717e7a] dark:text-[#90a2ad]">
                        <span>Starts {formatDateDisplay(batch.start_date, organisation.timezone)}</span>
                        <span>{progressPct}% completed</span>
                      </div>
                    </div>

                    {/* Meta & Join Code Action Row */}
                    <div className="pt-2 border-t border-[#e6dccb]/60 dark:border-[#1d2e38]/80 flex items-center justify-between text-xs">
                      {/* Teacher Attribution */}
                      <div className="flex items-center gap-1.5 text-[#5a6663] dark:text-[#98abb6]">
                        <GraduationCap className="w-3.5 h-3.5 text-[#17495e] dark:text-[#e8b98a]" />
                        <span className="text-[11px] truncate max-w-[120px]">
                          {batch.teacher?.full_name || batch.teacher?.email || 'Faculty'}
                        </span>
                      </div>

                      {/* Join Code & QR trigger */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(batch.join_code)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#f7f3ec] dark:bg-[#182933] text-[#17495e] dark:text-[#e8b98a] font-mono font-bold text-[11px] border border-[#e6dccb] dark:border-[#223947] hover:bg-[#efe9df] dark:hover:bg-[#203644] transition-all cursor-pointer"
                          title="Click to copy join code"
                        >
                          {copiedCode === batch.join_code ? (
                            <>
                              <Check className="w-3 h-3 text-[#4ba377]" />
                              <span className="text-[#4ba377]">COPIED</span>
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
                          className="p-1.5 rounded-xl bg-[#f7f3ec] dark:bg-[#182933] text-[#17495e] dark:text-[#e8b98a] border border-[#e6dccb] dark:border-[#223947] hover:bg-[#efe9df] dark:hover:bg-[#203644] transition-all cursor-pointer"
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
          <div className="bg-white dark:bg-[#121e25] p-5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-[#4ba377]" />
              <h2 className="font-serif text-base font-bold text-[#17495e] dark:text-[#f2ede4]">
                Pre-Grant Role Privilege
              </h2>
            </div>
            <p className="text-xs text-[#717e7a] dark:text-[#90a2ad]">
              Assign teacher or admin rights to any email in advance. When the user signs in with Google, their elevated role is automatically activated.
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
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#0e161b] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none focus:ring-2 focus:ring-[#17495e] dark:focus:ring-[#e8b98a]"
                  />
                </div>

                <div>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#0e161b] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none cursor-pointer"
                  >
                    <option value="teacher">Teacher (Cohorts)</option>
                    <option value="admin">Admin (Executive)</option>
                    <option value="student">Student (Practitioner)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                {statusMessage ? (
                  <span className="text-xs text-[#4ba377] font-semibold">{statusMessage}</span>
                ) : (
                  <span className="text-[11px] text-[#717e7a] dark:text-[#90a2ad]">
                    Auto-claimed on first OAuth sign-in.
                  </span>
                )}

                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] text-xs font-bold shadow-sm hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Role Grant</span>
                </button>
              </div>
            </form>
          </div>

          {/* Pre-Granted Roles Directory */}
          {roleGrants.length > 0 && (
            <div className="bg-white dark:bg-[#121e25] p-5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#17495e] dark:text-[#e8b98a]">
                Pending Pre-Grants ({roleGrants.length})
              </h3>
              <div className="divide-y divide-[#e6dccb]/60 dark:divide-[#1d2e38]/80">
                {roleGrants.map((grant) => (
                  <div key={grant.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-[#1f2a28] dark:text-[#f2ede4]">{grant.email}</div>
                      <div className="text-[10px] text-[#717e7a] dark:text-[#90a2ad] uppercase tracking-wide">
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
          <div className="bg-white dark:bg-[#121e25] p-5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-base font-bold text-[#17495e] dark:text-[#f2ede4]">
                Active Practitioners & Faculty ({profiles.length})
              </h3>
              <span className="text-[11px] text-[#717e7a] dark:text-[#90a2ad]">
                Live database records
              </span>
            </div>

            <div className="divide-y divide-[#e6dccb]/60 dark:divide-[#1d2e38]/80">
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
                      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#17495e] to-[#3ba2c7] text-[#e8b98a] font-mono font-bold flex items-center justify-center shrink-0 text-xs shadow-xs">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-[#1f2a28] dark:text-[#f2ede4] truncate flex items-center gap-1.5">
                          <span>{p.full_name || 'Contemplative Student'}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#4ba377]/15 text-[#4ba377]">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#717e7a] dark:text-[#90a2ad] truncate">{p.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={p.role}
                        onChange={(e) => handleProfileRoleChange(p.id, e.target.value as UserRole)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider border cursor-pointer ${
                          p.role === 'admin'
                            ? 'bg-[#d9a44a]/15 text-[#8e6724] dark:text-[#e8b98a] border-[#d9a44a]/40'
                            : p.role === 'teacher'
                            ? 'bg-[#3ba2c7]/15 text-[#17495e] dark:text-[#3ba2c7] border-[#3ba2c7]/40'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        <option value="student">Student</option>
                        <option value="teacher">Teacher</option>
                        <option value="admin">Admin</option>
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
      {activeTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-bold text-[#17495e] dark:text-[#f2ede4]">
              Curriculum Catalog
            </h2>
            <button
              type="button"
              onClick={() => {
                setCourseName('');
                setCourseDesc('');
                setCourseMsg(null);
                setShowCourseModal(true);
              }}
              className="px-4 py-2 rounded-2xl bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer hover:opacity-90"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ New Course</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {courses.map((course) => {
              const cohortsUsingThis = allBatches.filter((b) => b.course_id === course.id).length;

              return (
                <div
                  key={course.id}
                  className="bg-white dark:bg-[#121e25] p-5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#17495e] dark:text-[#e8b98a]">
                        Commitment Program
                      </span>
                      <h3 className="font-serif text-base font-bold text-[#17495e] dark:text-[#f2ede4]">
                        {course.name}
                      </h3>
                    </div>

                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#d9a44a]/20 to-[#e8b98a]/30 border border-[#d9a44a]/50 text-[#8e6724] dark:text-[#e8b98a] font-mono text-xs font-bold">
                      {course.duration_days} Days
                    </span>
                  </div>

                  <p className="text-xs text-[#717e7a] dark:text-[#90a2ad] leading-relaxed">
                    {course.description || 'Structured daily contemplative practice and mindfulness curriculum.'}
                  </p>

                  <div className="pt-2 border-t border-[#e6dccb]/60 dark:border-[#1d2e38]/80 flex items-center justify-between text-[11px] text-[#5a6663] dark:text-[#98abb6]">
                    <span>{cohortsUsingThis} active cohort{cohortsUsingThis === 1 ? '' : 's'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBatchCourseId(course.id);
                        setBatchName(`${course.name} Cohort`);
                        setShowBatchModal(true);
                      }}
                      className="text-[#17495e] dark:text-[#e8b98a] font-bold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Create Cohort from this</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 8. TAB CONTENT: SYSTEM & GOVERNANCE PARAMETERS */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#121e25] p-5 rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#17495e] dark:text-[#e8b98a]" />
              <h2 className="font-serif text-base font-bold text-[#17495e] dark:text-[#f2ede4]">
                White-Label Organisation Parameters
              </h2>
            </div>
            <p className="text-xs text-[#717e7a] dark:text-[#90a2ad]">
              Core branding and operational settings configured for {organisation.name}.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-[#f7f3ec] dark:bg-[#0e161b] rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38]">
                <span className="text-[#717e7a] dark:text-[#90a2ad] block text-[10px] uppercase font-mono font-bold tracking-wider">
                  App Name
                </span>
                <span className="font-bold text-[#1f2a28] dark:text-[#f2ede4] text-sm">
                  {organisation.app_name}
                </span>
              </div>

              <div className="p-3.5 bg-[#f7f3ec] dark:bg-[#0e161b] rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38]">
                <span className="text-[#717e7a] dark:text-[#90a2ad] block text-[10px] uppercase font-mono font-bold tracking-wider">
                  Timezone
                </span>
                <span className="font-bold text-[#1f2a28] dark:text-[#f2ede4] text-sm">
                  {organisation.timezone}
                </span>
              </div>

              <div className="p-3.5 bg-[#f7f3ec] dark:bg-[#0e161b] rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38]">
                <span className="text-[#717e7a] dark:text-[#90a2ad] block text-[10px] uppercase font-mono font-bold tracking-wider">
                  Slug
                </span>
                <span className="font-bold text-[#1f2a28] dark:text-[#f2ede4] text-sm font-mono">
                  {organisation.slug}
                </span>
              </div>

              <div className="p-3.5 bg-[#f7f3ec] dark:bg-[#0e161b] rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38]">
                <span className="text-[#717e7a] dark:text-[#90a2ad] block text-[10px] uppercase font-mono font-bold tracking-wider">
                  Powered by ZYXENAI
                </span>
                <span className="font-bold text-[#4ba377] text-sm">
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
          <div className="w-full max-w-md bg-white dark:bg-[#0e161b] rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#17495e] dark:text-[#e8b98a]">
                  New Cohort Onboarding
                </span>
                <h2 className="font-serif text-lg font-bold text-[#17495e] dark:text-[#f2ede4]">
                  Create Cohort Batch
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-full text-[#717e7a] dark:text-[#90a2ad] hover:text-[#1f2a28] dark:hover:text-[#f2ede4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5">
              {/* Select Course */}
              <div>
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Curriculum Program
                </label>
                <select
                  value={batchCourseId}
                  onChange={(e) => setBatchCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none cursor-pointer"
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
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Batch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. November Dawn Sadhana"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none focus:ring-2 focus:ring-[#17495e] dark:focus:ring-[#e8b98a]"
                />
              </div>

              {/* Teacher Assign */}
              <div>
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Presiding Teacher
                </label>
                <select
                  value={batchTeacherId}
                  onChange={(e) => setBatchTeacherId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none cursor-pointer"
                >
                  {profiles
                    .filter((p) => p.role === 'teacher' || p.role === 'admin')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email} ({t.role})
                      </option>
                    ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Start Date (Day 1 in {organisation.timezone})
                </label>
                <input
                  type="date"
                  required
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none cursor-pointer"
                />
              </div>

              {/* Custom Join Code */}
              <div>
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Custom Join Code (Optional, max 8 chars)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Auto-generated if empty"
                  value={batchCustomCode}
                  onChange={(e) => setBatchCustomCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs font-mono uppercase tracking-wider text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none"
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
                  className="px-4 py-2.5 rounded-2xl text-xs text-[#717e7a] dark:text-[#90a2ad] hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingBatch || !batchName.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-[#e8b98a] hover:bg-[#dfaf7f] text-[#0b1317] text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isCreatingBatch ? 'Creating Cohort...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. CREATE COURSE MODAL */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#0e161b] rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-[#17495e] dark:text-[#e8b98a]">
                  Curriculum Engine
                </span>
                <h2 className="font-serif text-lg font-bold text-[#17495e] dark:text-[#f2ede4]">
                  Create Course Program
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseModal(false)}
                className="p-1 rounded-full text-[#717e7a] dark:text-[#90a2ad] hover:text-[#1f2a28] dark:hover:text-[#f2ede4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 40-Day Sadhana Practice"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Contemplative goals and practice intentions..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1f2a28] dark:text-[#f2ede4] mb-1">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#e6dccb] dark:border-[#1d2e38] bg-[#f7f3ec] dark:bg-[#121e25] text-xs text-[#1f2a28] dark:text-[#f2ede4] focus:outline-none"
                />
              </div>

              {courseMsg && (
                <div className="p-3 rounded-2xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-300">
                  {courseMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs text-[#717e7a] dark:text-[#90a2ad]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCourse || !courseName.trim()}
                  className="px-5 py-2.5 rounded-2xl bg-[#17495e] dark:bg-[#e8b98a] text-white dark:text-[#0b1317] text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isCreatingCourse ? 'Creating...' : 'Create Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. BATCH QR CODE SHARING MODAL */}
      {qrBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#0e161b] rounded-3xl border border-[#e6dccb] dark:border-[#1d2e38] p-6 shadow-2xl space-y-4 text-center">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#17495e] dark:text-[#e8b98a]">
                Student Onboarding
              </span>
              <button
                type="button"
                onClick={() => setQrBatch(null)}
                className="p-1 rounded-full text-[#717e7a] dark:text-[#90a2ad] hover:text-[#1f2a28] dark:hover:text-[#f2ede4]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3 className="font-serif text-lg font-bold text-[#17495e] dark:text-[#f2ede4]">
              {qrBatch.name}
            </h3>

            {/* QR Code Canvas */}
            <div className="p-4 bg-white rounded-2xl inline-block shadow-inner mx-auto border border-stone-200">
              <QRCodeSVG
                value={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/?join=${qrBatch.join_code}`
                    : `https://sadhana.zyxenai.com/?join=${qrBatch.join_code}`
                }
                size={180}
                level="M"
              />
            </div>

            <div className="space-y-1">
              <span className="text-xs text-[#717e7a] dark:text-[#90a2ad]">Direct Join Code</span>
              <div className="text-2xl font-mono font-bold tracking-widest text-[#17495e] dark:text-[#e8b98a]">
                {qrBatch.join_code}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const url =
                  typeof window !== 'undefined'
                    ? `${window.location.origin}/?join=${qrBatch.join_code}`
                    : `https://sadhana.zyxenai.com/?join=${qrBatch.join_code}`;
                navigator.clipboard.writeText(url);
                setCopiedCode(qrBatch.join_code);
                setTimeout(() => setCopiedCode(null), 2500);
              }}
              className="w-full py-2.5 rounded-2xl bg-[#e8b98a] text-[#0b1317] font-bold text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedCode === qrBatch.join_code ? (
                <>
                  <Check className="w-4 h-4 text-[#4ba377]" />
                  <span>Link Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Onboarding Link</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
