import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { fetchCourses, createCourse, fetchTeacherBatches } from '../lib/batchService';
import { formatDateDisplay } from '../lib/dateUtils';
import type { Profile, RoleGrant, UserRole, Course, Batch } from '../types/database';
import {
  Shield,
  UserPlus,
  Settings,
  Check,
  Trash2,
  RefreshCw,
  BookOpen,
  PlusCircle,
  Users,
} from 'lucide-react';

export const AdminHome: React.FC = () => {
  const { organisation, profile: currentProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'courses' | 'batches'>('users');

  // Users & Roles state
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roleGrants, setRoleGrants] = useState<RoleGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Courses state
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [durationDays, setDurationDays] = useState(40);
  const [courseMsg, setCourseMsg] = useState<string | null>(null);

  // All Batches state
  const [allBatches, setAllBatches] = useState<Batch[]>([]);

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

      if (profsRes.data) setProfiles(profsRes.data as Profile[]);
      if (grantsRes.data) setRoleGrants(grantsRes.data as RoleGrant[]);
      setCourses(courseList);
      setAllBatches(batchList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [organisation.id]);

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

      // Also update existing profile if present
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

  const handleDeleteRoleGrant = async (grantId: string) => {
    try {
      await supabase.from('role_grants').delete().eq('id', grantId);
      await loadData();
    } catch (err) {
      console.error('Failed to remove role grant:', err);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organisation.id || !courseName.trim()) return;

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
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Shield className="w-4 h-4" />
            <span>Admin Console &bull; {organisation.name}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Admin Management
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Oversee organisation roles, course curricula, and student cohorts.
        </p>
      </div>

      {/* Admin Tabs */}
      <div className="flex p-1 bg-stone-100 dark:bg-stone-800/60 rounded-xl border border-stone-200 dark:border-stone-700/80 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex-1 py-2 font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          Users & Roles ({profiles.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('courses')}
          className={`flex-1 py-2 font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'courses'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          Courses ({courses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          className={`flex-1 py-2 font-medium rounded-lg transition-all cursor-pointer ${
            activeTab === 'batches'
              ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm'
              : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          All Batches ({allBatches.length})
        </button>
      </div>

      {/* Tab: Users & Roles */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Grant Role Form */}
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
              <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Assign / Pre-grant Role</span>
            </div>

            <form onSubmit={handleAddRoleGrant} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="student">Student (Default)</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Role Assignment</span>
              </button>

              {statusMessage && (
                <div className="p-3 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs text-stone-700 dark:text-stone-300">
                  {statusMessage}
                </div>
              )}
            </form>
          </div>

          {/* Role Grants List */}
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Pre-Granted Roles ({roleGrants.length})
            </div>

            {roleGrants.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No pre-assigned role grants yet.</p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {roleGrants.map((grant) => (
                  <div key={grant.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-stone-800 dark:text-stone-200">{grant.email}</div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">{grant.role}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoleGrant(grant.id)}
                      className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                      title="Remove grant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Profiles List */}
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
            <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Active Profiles ({profiles.length})
            </div>

            {profiles.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No users have signed in yet.</p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {profiles.map((p) => (
                  <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-medium text-stone-800 dark:text-stone-200">
                        {p.full_name || 'No Name'}
                        {p.id === currentProfile?.id && (
                          <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">(You)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-stone-500">{p.email}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                      {p.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Courses */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  Course Catalog
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCourseModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold cursor-pointer shadow-sm hover:opacity-90"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Course</span>
              </button>
            </div>

            {courses.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No courses created yet.</p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {courses.map((c) => (
                  <div key={c.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-900 dark:text-stone-100">{c.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
                        {c.duration_days} Days
                      </span>
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: All Batches */}
      {activeTab === 'batches' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                All Organisation Batches ({allBatches.length})
              </h2>
            </div>

            {allBatches.length === 0 ? (
              <p className="text-xs text-stone-400 italic">No batches created in this organisation yet.</p>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {allBatches.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">{b.name}</span>
                        <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-stone-100 dark:bg-stone-800 font-bold">
                          {b.join_code}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500">
                        Course: {b.course?.name || 'Sadhana'} &bull; Teacher: {b.teacher?.full_name || b.teacher?.email}
                      </div>
                    </div>

                    <div className="text-right text-[11px] text-stone-400">
                      Starts {formatDateDisplay(b.start_date, organisation.timezone)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Organisation Settings Overview */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
          <Settings className="w-4 h-4 text-stone-500" />
          <span>Organisation Parameters</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">App Name</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">{organisation.app_name}</span>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">Slug</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">{organisation.slug}</span>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">Timezone</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">{organisation.timezone}</span>
          </div>
          <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-xl">
            <span className="text-stone-400 block text-[10px]">Powered by ZYXENAI</span>
            <span className="font-medium text-stone-800 dark:text-stone-200">
              {organisation.show_powered_by ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      {/* Create Course Modal */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Create Course Programme
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Define the curriculum name and target commitment duration.
              </p>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 40-Day Sadhana Practice"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief curriculum description..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Duration (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>

              {courseMsg && (
                <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs text-stone-700 dark:text-stone-300">
                  {courseMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!courseName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow"
                >
                  Create Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
