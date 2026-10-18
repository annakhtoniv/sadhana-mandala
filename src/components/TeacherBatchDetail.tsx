import React, { useState, useEffect, useMemo } from 'react';
import { fetchBatchEnrolments, fetchBatchInvites, addBatchInvites } from '../lib/batchService';
import { fetchBatchCheckins, calculateStreak, isStudentQuiet } from '../lib/checkinService';
import { hasEvening, hasMorning, isPractised } from '../lib/practiceUtils';
import { formatDateDisplay, calculateDayNumber } from '../lib/dateUtils';
import { hasPracticeTrack, programmeRunStatus, RUN_STATUS_LABEL } from '../lib/programmeUtils';
import { fetchProgrammeModules, fetchStudentsLessonProgress } from '../lib/lmsService';
import { BatchFollowups } from './BatchFollowups';
import { BatchSharePanel } from './BatchSharePanel';
import { BatchEditor } from './BatchEditor';
import { Avatar } from './Avatar';
import type { Batch, Enrolment, BatchInvite, Organisation, Checkin } from '../types/database';
import {
  ArrowLeft,
  UserPlus,
  Users,
  QrCode,
  Copy,
  Check,
  Mail,
  RefreshCw,
  Sparkles,
  Flame,
  AlertTriangle,
  Moon,
  Sun,
  ArrowUpDown,
  Pencil,
} from 'lucide-react';

interface TeacherBatchDetailProps {
  batch: Batch;
  organisation: Organisation;
  onBack: () => void;
  /** Called after the batch was edited */
  onBatchUpdated?: (batch: Batch) => void;
  /** Admins can give the batch to another teacher */
  canChangeTeacher?: boolean;
  backLabel?: string;
}

type SortField = 'name' | 'streak' | 'status' | 'quiet';

/** Sort order for today's ticks: both first, then one, then none */
const TICKS_ORDER: Record<string, number> = { both: 0, morning: 1, evening: 1, none: 2 };
function ticksLabel(m: boolean, e: boolean): string {
  return m && e ? 'morning and evening' : m ? 'morning' : e ? 'evening' : 'no tick';
}

function formatShortDate(isoTimestamp: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, day: 'numeric', month: 'short' }).format(new Date(isoTimestamp));
  } catch {
    return '';
  }
}

export const TeacherBatchDetail: React.FC<TeacherBatchDetailProps> = ({
  batch,
  organisation,
  onBack,
  onBatchUpdated,
  canChangeTeacher = false,
  backLabel = 'Back to My Batches',
}) => {
  const [editing, setEditing] = useState(false);
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [invites, setInvites] = useState<BatchInvite[]>([]);
  const [batchCheckins, setBatchCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Phase 6: published lesson ids of this programme, and lessons completed per student
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Map<string, Set<string>>>(new Map());

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [isSubmittingInvites, setIsSubmittingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Sorting state for roster
  // Check-in counts, streaks and Quiet flags only exist for programmes with a practice track
  const practice = hasPracticeTrack(batch.course);
  const [sortBy, setSortBy] = useState<SortField>(practice ? 'quiet' : 'name');

  const durationDays = batch.course?.duration_days || 40;
  const currentDay = calculateDayNumber(batch.start_date, organisation.timezone);
  const isFinished = currentDay > durationDays;
  const hasStarted = currentDay >= 1;
  // The day the counts describe: today while running, the last day once finished
  const countsDay = Math.min(currentDay, durationDays);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [enrList, invList, checkinList] = await Promise.all([
        fetchBatchEnrolments(batch.id),
        fetchBatchInvites(batch.id),
        fetchBatchCheckins(batch.id),
      ]);
      setEnrolments(enrList);
      setInvites(invList);
      setBatchCheckins(checkinList);

      // Learning progress is extra information: a failure here must not hide the roster
      try {
        const [modules, progress] = await Promise.all([
          fetchProgrammeModules(batch.course_id),
          fetchStudentsLessonProgress(enrList.map((e) => e.student_id)),
        ]);
        setLessonIds(
          modules.filter((m) => m.published).flatMap((m) => (m.lessons || []).filter((l) => l.published).map((l) => l.id))
        );
        setLessonProgress(progress);
      } catch (err) {
        console.warn('Could not load lesson progress:', err);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load this batch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [batch.id]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(batch.join_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleAddInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailText.trim()) return;

    setIsSubmittingInvites(true);
    setInviteResult(null);

    const res = await addBatchInvites(batch.id, emailText);
    if (res.success) {
      setInviteResult(
        `Added ${res.totalInvites} invite(s). ${res.totalAutoEnrolled} student account(s) auto-enrolled immediately!`
      );
      setEmailText('');
      await loadData();
    } else {
      setInviteResult(`Error: ${res.error || 'Failed to add invites'}`);
    }
    setIsSubmittingInvites(false);
  };

  // Build per-student check-in metrics
  const studentMetrics = useMemo(() => {
    const checkinsByStudent = new Map<string, Checkin[]>();
    for (const c of batchCheckins) {
      const list = checkinsByStudent.get(c.student_id) || [];
      list.push(c);
      checkinsByStudent.set(c.student_id, list);
    }

    return enrolments.map((enr) => {
      const studentId = enr.student_id;
      const studentChecks = checkinsByStudent.get(studentId) || [];

      // Sort by day_number ascending
      studentChecks.sort((a, b) => a.day_number - b.day_number);

      const todayCheck = hasStarted ? studentChecks.find((c) => c.day_number === countsDay) : undefined;
      const streak = calculateStreak(studentChecks, currentDay, durationDays);
      const isQuiet = practice && isStudentQuiet(studentChecks, currentDay, 4, durationDays);

      // Last day with a tick
      const practisedDays = studentChecks.filter(isPractised);
      const lastCheckin = practisedDays.length > 0 ? practisedDays[practisedDays.length - 1] : null;
      const todayMorning = hasMorning(todayCheck);
      const todayEvening = hasEvening(todayCheck);

      return {
        enrolment: enr,
        todayStatus: todayMorning && todayEvening ? 'both' : todayMorning ? 'morning' : todayEvening ? 'evening' : 'none',
        todayMorning,
        todayEvening,
        streak,
        isQuiet,
        practisedCount: practisedDays.length,
        lateCount: studentChecks.filter((c) => c.late).length,
        lastCheckinDay: lastCheckin?.day_number || null,
        lastCheckinStatus: lastCheckin ? ticksLabel(hasMorning(lastCheckin), hasEvening(lastCheckin)) : null,
        lastCheckinAt: lastCheckin?.updated_at || null,
      };
    });
  }, [enrolments, batchCheckins, currentDay, countsDay, durationDays, hasStarted, practice]);

  // Today's summary counts
  const summaryCounts = useMemo(() => {
    let morning = 0;
    let evening = 0;
    let both = 0;
    let none = 0;
    let quiet = 0;

    for (const s of studentMetrics) {
      if (s.isQuiet) quiet++;
      if (s.todayMorning) morning++;
      if (s.todayEvening) evening++;
      if (s.todayMorning && s.todayEvening) both++;
      if (!s.todayMorning && !s.todayEvening) none++;
    }

    return { morning, evening, both, none, quiet, total: studentMetrics.length };
  }, [studentMetrics]);

  // Sorted roster
  const sortedRoster = useMemo(() => {
    const list = [...studentMetrics];
    list.sort((a, b) => {
      if (sortBy === 'quiet') {
        if (a.isQuiet && !b.isQuiet) return -1;
        if (!a.isQuiet && b.isQuiet) return 1;
        return b.streak - a.streak;
      }
      if (sortBy === 'streak') {
        return b.streak - a.streak;
      }
      if (sortBy === 'status') {
        return TICKS_ORDER[a.todayStatus] - TICKS_ORDER[b.todayStatus];
      }
      const nameA = a.enrolment.student?.full_name || a.enrolment.student?.email || '';
      const nameB = b.enrolment.student?.full_name || b.enrolment.student?.email || '';
      return nameA.localeCompare(nameB);
    });
    return list;
  }, [studentMetrics, sortBy]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Top back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>{backLabel}</span>
      </button>

      {/* Batch Header */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            {batch.course?.name || 'Sadhana Course'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-mono font-medium">
            {!practice
              ? RUN_STATUS_LABEL[programmeRunStatus(batch.course, currentDay)]
              : currentDay < 1
              ? `Starts in ${Math.abs(currentDay - 1)}d`
              : currentDay <= durationDays
              ? `Day ${currentDay} of ${durationDays}`
              : `Finished`}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
              {batch.name}
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Started {formatDateDisplay(batch.start_date, organisation.timezone)} &bull; {durationDays}-day practice
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="ui-btn-ghost !py-1.5 !px-3.5 !text-xs" title="Edit batch">
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
          Could not load this batch: {loadError}
        </div>
      )}

      {/* Counts for today (SPEC: "counts for today"); practice programmes only */}
      {practice && (
      <div className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {!hasStarted
            ? 'Not started yet'
            : isFinished
            ? `Final day · Day ${durationDays}`
            : `Today · Day ${currentDay}`}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Morning', value: summaryCounts.morning, tone: 'text-amber-600 dark:text-amber-400' },
            { label: 'Evening', value: summaryCounts.evening, tone: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'No tick', value: summaryCounts.none, tone: 'text-stone-500 dark:text-stone-400' },
            { label: 'Quiet', value: summaryCounts.quiet, tone: 'text-red-600 dark:text-red-400' },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-stone-900 px-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 text-center space-y-0.5"
            >
              <div className={`text-[10px] leading-tight uppercase font-semibold ${card.tone}`}>{card.label}</div>
              <div className="text-xl font-bold text-stone-900 dark:text-stone-100">{card.value}</div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Follow-ups of this batch (Phase 7) */}
      <BatchFollowups batch={batch} currentDay={currentDay} enrolments={enrolments} timeZone={organisation.timezone} />

      {/* Join Code & Quick Actions */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 uppercase tracking-wide">
            Batch Join Code & QR
          </span>
          <button
            type="button"
            onClick={() => setShowQR(!showQR)}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{showQR ? 'Hide QR' : 'Show QR & share'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 bg-stone-100 dark:bg-stone-800 px-4 py-3 rounded-xl font-mono text-base font-bold tracking-widest text-center text-stone-900 dark:text-stone-100 select-all border border-stone-200 dark:border-stone-700">
            {batch.join_code}
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Batch QR: scan, sign in with Google, enrolled automatically */}
        {showQR && (
          <BatchSharePanel
            batchName={batch.name}
            courseName={batch.course?.name || ''}
            joinCode={batch.join_code}
            appName={organisation.app_name}
          />
        )}

        <button
          type="button"
          onClick={() => setShowInviteModal(true)}
          className="w-full py-3 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Paste Student Emails (Auto-Enrol)</span>
        </button>
      </div>

      {/* Student Roster Section */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-stone-400" />
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Student Roster ({studentMetrics.length})
            </h2>
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <ArrowUpDown className="w-3 h-3 text-stone-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 text-xs text-stone-700 dark:text-stone-300 focus:outline-none"
            >
              {practice && <option value="quiet">Sort: Quiet first</option>}
              {practice && <option value="streak">Sort: Streak (high to low)</option>}
              <option value="name">Sort: Name (A-Z)</option>
              {practice && <option value="status">Sort: Today's Status</option>}
            </select>
          </div>
        </div>

        {studentMetrics.length === 0 ? (
          <p className="text-xs text-stone-400 italic py-2">No students enrolled in this batch yet.</p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {sortedRoster.map(({ enrolment: enr, todayMorning, todayEvening, streak, isQuiet, practisedCount, lateCount, lastCheckinDay, lastCheckinStatus, lastCheckinAt }) => (
              <div key={enr.id} className="py-3.5 flex items-center justify-between text-xs gap-2">
                <div className="flex items-start gap-3 min-w-0">
                <Avatar name={enr.student?.full_name || enr.student?.email} url={enr.student?.avatar_url} size={34} />
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {enr.student?.full_name || 'Practitioner'}
                    </span>
                    {isQuiet && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 flex items-center gap-0.5 border border-red-200 dark:border-red-900">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        <span>Quiet</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 truncate">{enr.student?.email}</div>
                  {lessonIds.length > 0 && (
                    <div className="text-[10px] text-stone-400">
                      Lessons: {lessonIds.filter((id) => lessonProgress.get(enr.student_id)?.has(id)).length} of {lessonIds.length}
                    </div>
                  )}
                  {practice && (
                  <div className="text-[10px] text-stone-400 flex items-center gap-1.5 pt-0.5">
                    <span>
                      Last practice:{' '}
                      {lastCheckinDay
                        ? `Day ${lastCheckinDay} (${lastCheckinStatus})${
                            lastCheckinAt ? ` · ${formatShortDate(lastCheckinAt, organisation.timezone)}` : ''
                          }`
                        : 'None yet'}
                      {' · '}
                      {practisedCount} day{practisedCount === 1 ? '' : 's'}
                      {lateCount > 0 ? ` (${lateCount} added later)` : ''}
                    </span>
                  </div>
                  )}
                </div>

                </div>
                {practice && (
                <div className="text-right space-y-1 shrink-0">
                  {/* Today's Status Badge */}
                  <div>
                    <span className="inline-flex items-center gap-1" aria-label={`Today: ${ticksLabel(todayMorning, todayEvening)}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${todayMorning ? 'bg-amber-400 text-stone-900' : 'bg-stone-100 text-stone-300'}`} title="Morning">
                        <Sun className="w-3.5 h-3.5" />
                      </span>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${todayEvening ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-300'}`} title="Evening">
                        <Moon className="w-3.5 h-3.5" />
                      </span>
                    </span>
                  </div>

                  {/* Streak */}
                  <div className="text-[11px] text-stone-500 flex items-center gap-1 justify-end font-medium">
                    <Flame className={`w-3.5 h-3.5 ${streak > 0 ? 'text-amber-500 fill-amber-500' : 'text-stone-300'}`} />
                    <span>{streak}d streak</span>
                  </div>
                </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invites List */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-stone-400" />
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Invited Emails ({invites.length})
          </h2>
        </div>

        {invites.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No email invites added yet.</p>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {invites.map((inv) => (
              <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                <span className="text-stone-700 dark:text-stone-300 font-mono text-[11px]">
                  {inv.email}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    inv.claimed_by
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {inv.claimed_by ? 'Enrolled' : 'Pending Sign-in'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Emails Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-xl space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>Auto-Mapping Enrolment</span>
              </div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Paste Student Emails
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                Paste student email addresses below (separated by commas, spaces, or lines). If an email already exists in {organisation.app_name}, the student is enrolled automatically!
              </p>
            </div>

            <form onSubmit={handleAddInvites} className="space-y-4">
              <textarea
                rows={5}
                required
                placeholder="alice@example.com&#10;bob@example.com&#10;charlie@example.com"
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-stone-500"
              />

              {inviteResult && (
                <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl text-xs text-stone-700 dark:text-stone-300">
                  {inviteResult}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvites || !emailText.trim()}
                  className="px-4 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSubmittingInvites ? 'Adding...' : 'Process Emails'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editing && (
        <BatchEditor
          batch={batch}
          orgId={organisation.id}
          canChangeTeacher={canChangeTeacher}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            onBatchUpdated?.(updated);
          }}
        />
      )}
    </div>
  );
};
