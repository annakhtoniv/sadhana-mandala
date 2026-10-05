import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchTeacherBatches, fetchCourses, createBatch } from '../lib/batchService';
import { formatDateDisplay, getTodayInTimezone, calculateDayNumber } from '../lib/dateUtils';
import { TeacherBatchDetail } from './TeacherBatchDetail';
import type { Batch, Course } from '../types/database';
import { GraduationCap, Users, PlusCircle, Sparkles, ChevronRight, Calendar, RefreshCw } from 'lucide-react';

export const TeacherHome: React.FC = () => {
  const { organisation, user, profile, role } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  // Create Batch Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [startDate, setStartDate] = useState(getTodayInTimezone(organisation.timezone));
  const [customJoinCode, setCustomJoinCode] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const isAdmin = role === 'admin';

  const loadData = async () => {
    if (!user || !organisation.id) return;
    setLoading(true);
    try {
      const [batchList, courseList] = await Promise.all([
        fetchTeacherBatches(user.id, isAdmin),
        fetchCourses(organisation.id),
      ]);
      setBatches(batchList);
      setCourses(courseList);
      if (courseList.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courseList[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, organisation.id]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organisation.id || !selectedCourseId || !batchName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    const result = await createBatch({
      orgId: organisation.id,
      courseId: selectedCourseId,
      teacherId: user.id,
      name: batchName.trim(),
      startDate: startDate,
      joinCode: customJoinCode.trim() || undefined,
    });

    if (result.success && result.data) {
      setShowCreateModal(false);
      setBatchName('');
      setCustomJoinCode('');
      await loadData();
      setSelectedBatch(result.data);
    } else {
      setCreateError(result.error || 'Failed to create batch');
    }
    setIsCreating(false);
  };

  if (selectedBatch) {
    return (
      <TeacherBatchDetail
        batch={selectedBatch}
        organisation={organisation}
        onBack={() => {
          setSelectedBatch(null);
          loadData();
        }}
      />
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Header card */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <GraduationCap className="w-4 h-4" />
            <span>Teacher Dashboard &bull; {organisation.app_name}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            title="Refresh Batches"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Welcome, {profile?.full_name || 'Teacher'}
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Manage your batches, invite students, and view daily practice commitments in {organisation.timezone}.
        </p>
      </div>

      {/* Batches List Section */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              My Batches ({batches.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Batch</span>
          </button>
        </div>

        {batches.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-dashed border-stone-200 dark:border-stone-700/80 space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                No batches created yet
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-xs mx-auto">
                Create a batch to generate a unique join code and QR code, paste student emails, and begin tracking practice.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-medium cursor-pointer shadow"
            >
              Create Your First Batch
            </button>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {batches.map((b) => {
              const currentDay = calculateDayNumber(b.start_date, organisation.timezone);
              const durationDays = b.course?.duration_days || 40;

              return (
                <button
                  type="button"
                  key={b.id}
                  onClick={() => setSelectedBatch(b)}
                  className="w-full py-3.5 flex items-center justify-between text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-2 transition-colors cursor-pointer"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-stone-900 dark:text-stone-100">
                        {b.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-bold">
                        {b.join_code}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
                      <span>{b.course?.name || 'Sadhana Course'}</span>
                      <span>&bull;</span>
                      <span>Starts {formatDateDisplay(b.start_date, organisation.timezone)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {currentDay < 1
                        ? `Starts in ${Math.abs(currentDay - 1)}d`
                        : currentDay <= durationDays
                        ? `Day ${currentDay}/${durationDays}`
                        : `Finished`}
                    </span>
                    <ChevronRight className="w-4 h-4 text-stone-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Teacher Security & Row Isolation info */}
      <div className="bg-stone-100/70 dark:bg-stone-800/30 p-4 rounded-xl border border-stone-200/60 dark:border-stone-800/60 text-xs text-stone-600 dark:text-stone-400 space-y-1">
        <div className="font-medium text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Batch Security Rule</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          Enforced by database Row Level Security: Teachers can invite students, view their roster, and track practice check-ins exclusively for their own batches within this organisation.
        </p>
      </div>

      {/* Create Batch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Create New Batch
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Set up a student cohort for daily practice.
              </p>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-3.5">
              {/* Course select */}
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Course Programme
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none cursor-pointer"
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
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Batch Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. October 2026 Morning Sadhana"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Start Date (Day 1)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs focus:outline-none cursor-pointer"
                  />
                  <Calendar className="w-4 h-4 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Join Code (optional custom) */}
              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-300 mb-1">
                  Custom Join Code (Optional, max 8 chars)
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="Auto-generated if empty"
                  value={customJoinCode}
                  onChange={(e) => setCustomJoinCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-stone-500"
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-600 dark:text-red-400">
                  {createError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !batchName.trim()}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer shadow"
                >
                  {isCreating ? 'Creating...' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
