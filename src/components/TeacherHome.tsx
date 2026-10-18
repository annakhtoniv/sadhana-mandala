import React, { useState, useEffect } from 'react';
import { hasRole } from '../lib/roles';
import { useAuth } from '../context/AuthContext';
import { fetchTeacherBatches, fetchCourses, createBatch } from '../lib/batchService';
import { formatDateDisplay, getTodayInTimezone, calculateDayNumber } from '../lib/dateUtils';
import { TeacherBatchDetail } from './TeacherBatchDetail';
import { ProgrammesManager } from './ProgrammesManager';
import type { Batch, Course } from '../types/database';
import { GraduationCap, Users, PlusCircle, ChevronRight, RefreshCw, BookOpen } from 'lucide-react';
import { Sheet } from './Sheet';

export const TeacherHome: React.FC = () => {
  const { organisation, user, profile, role } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [showProgrammes, setShowProgrammes] = useState(false);

  // Create Batch Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [batchName, setBatchName] = useState('');
  const [startDate, setStartDate] = useState(getTodayInTimezone(organisation.timezone));
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const isAdmin = role === 'admin';

  const loadData = async () => {
    if (!user || !organisation.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [batchList, courseList] = await Promise.all([
        fetchTeacherBatches(user.id, isAdmin),
        fetchCourses(organisation.id),
      ]);
      setBatches(batchList);
      setCourses(courseList);
      if (!selectedCourseId && courseList.length > 0) {
        setSelectedCourseId(courseList[0].id);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, organisation.id]);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchName.trim()) {
      setCreateError('Please enter a batch name');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const courseIdToUse = selectedCourseId || courses[0]?.id || '';
    const orgIdToUse = organisation.id;
    const teacherIdToUse = user?.id || profile?.id || '';

    const result = await createBatch({
      orgId: orgIdToUse,
      courseId: courseIdToUse,
      teacherId: teacherIdToUse,
      name: batchName.trim(),
      startDate: startDate || getTodayInTimezone(organisation.timezone),
    });

    if (result.success && result.data) {
      const newBatch = result.data;
      setShowCreateModal(false);
      setBatchName('');
      // Optimistically add to state immediately
      setBatches((prev) => [newBatch, ...prev.filter((b) => b.id !== newBatch.id)]);
      setSelectedBatch(newBatch);
    } else {
      setCreateError(result.error || 'Failed to create batch. Please try again.');
    }
    setIsCreating(false);
  };

  if (showProgrammes) {
    return (
      <ProgrammesManager
        onBack={() => {
          setShowProgrammes(false);
          loadData();
        }}
      />
    );
  }

  if (selectedBatch) {
    return (
      <TeacherBatchDetail
        batch={selectedBatch}
        organisation={organisation}
        canChangeTeacher={hasRole(profile, 'admin')}
        onBatchUpdated={setSelectedBatch}
        onBack={() => {
          setSelectedBatch(null);
          loadData();
        }}
      />
    );
  }

  const openCreate = () => {
    setCreateError(null);
    setShowCreateModal(true);
  };

  return (
    <div className="w-full space-y-5 animate-fade-up">
      <section className="ui-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="ui-eyebrow">
              <GraduationCap className="w-3.5 h-3.5" /> Teacher
            </span>
            <h1 className="font-display text-2xl font-semibold text-stone-950 mt-3 user-text">
              Welcome, {profile?.full_name || 'Teacher'}
            </h1>
            <p className="text-sm text-stone-600 mt-1">Your batches, your students and their daily practice.</p>
          </div>
          <button type="button" onClick={loadData} disabled={loading} className="ui-icon-btn shrink-0" aria-label="Refresh">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button type="button" onClick={() => setShowProgrammes(true)} className="ui-btn-ghost w-full">
          <BookOpen className="w-4 h-4" />
          <span>Programmes ({courses.length})</span>
        </button>
      </section>

      <section className="ui-card space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-700" />
            My batches ({batches.length})
          </h2>
          <button type="button" onClick={openCreate} className="ui-btn-primary !px-4">
            <PlusCircle className="w-4 h-4" />
            <span>New batch</span>
          </button>
        </div>

        {loadError && (
          <div role="alert" className="p-3 rounded-xl bg-red-50 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>Your batches could not be loaded. {loadError}</span>
            <button type="button" onClick={loadData} className="ui-btn-ghost !min-h-9 !py-1.5 shrink-0">
              Try again
            </button>
          </div>
        )}

        {batches.length === 0 && !loading && !loadError ? (
          <div className="p-8 text-center rounded-2xl bg-stone-50 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-base font-semibold text-stone-900">No batches yet</p>
            <p className="text-sm text-stone-600 max-w-xs mx-auto">
              A batch is one group of students doing a programme together. It gets its own join code and QR code.
            </p>
            <button type="button" onClick={openCreate} className="ui-btn-primary">
              Create your first batch
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {batches.map((b) => {
              const currentDay = calculateDayNumber(b.start_date, organisation.timezone);
              const durationDays = b.course?.duration_days || 40;
              const status =
                currentDay < 1
                  ? `Starts ${formatDateDisplay(b.start_date, organisation.timezone)}`
                  : currentDay <= durationDays
                  ? `Day ${currentDay} of ${durationDays}`
                  : 'Finished';
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedBatch(b)}
                    className="w-full min-h-14 py-3 px-2 -mx-2 flex items-center justify-between gap-3 text-start hover:bg-stone-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-base text-stone-900 truncate user-text">{b.name}</span>
                      <span className="block text-sm text-stone-600 truncate">{b.course?.name || 'Programme'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          currentDay > durationDays ? 'bg-stone-100 text-stone-600' : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {status}
                      </span>
                      <ChevronRight className="w-5 h-5 text-stone-500 rtl:rotate-180" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Sheet
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New batch"
        description="A group of students who do a programme together."
        busy={isCreating}
        footer={
          <>
            <button type="button" onClick={() => setShowCreateModal(false)} className="ui-btn-ghost">
              Cancel
            </button>
            <button type="submit" form="create-batch" disabled={isCreating || !batchName.trim()} className="ui-btn-primary">
              {isCreating ? 'Creating...' : 'Create batch'}
            </button>
          </>
        }
      >
        <form id="create-batch" onSubmit={handleCreateBatch} className="space-y-4">
          <div>
            <label className="ui-label" htmlFor="cb-course">Programme</label>
            <select
              id="cb-course"
              value={selectedCourseId || courses[0]?.id || ''}
              onChange={(e) => setSelectedCourseId(e.target.value)}
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
            <label className="ui-label" htmlFor="cb-name">Batch name</label>
            <input
              id="cb-name"
              type="text"
              required
              maxLength={100}
              placeholder="For example: October 2026 mornings"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="ui-input"
            />
          </div>
          <div>
            <label className="ui-label" htmlFor="cb-start">First day</label>
            <input
              id="cb-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="ui-input cursor-pointer"
            />
          </div>
          {createError && (
            <p role="alert" className="text-sm text-red-700">
              {createError}
            </p>
          )}
        </form>
      </Sheet>
    </div>
  );
};
