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
import { Sheet } from './Sheet';
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
  backLabel = 'Back to my batches',
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
        `Added ${res.totalInvites} email${res.totalInvites === 1 ? '' : 's'}. ${res.totalAutoEnrolled} of them already had an account and joined straight away.`
      );
      setEmailText('');
      await loadData();
    } else {
      setInviteResult(res.error || 'The emails could not be added. Please try again.');
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

  const statusLabel = !practice
    ? RUN_STATUS_LABEL[programmeRunStatus(batch.course, currentDay)]
    : currentDay < 1
    ? `Starts ${formatDateDisplay(batch.start_date, organisation.timezone)}`
    : currentDay <= durationDays
    ? `Day ${currentDay} of ${durationDays}`
    : 'Finished';

  return (
    <div className="w-full space-y-5 animate-fade-up">
      <button type="button" onClick={onBack} className="ui-btn-ghost !min-h-10 !py-2 !px-4">
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        <span>{backLabel}</span>
      </button>

      <section className="ui-card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="ui-eyebrow">{batch.course?.name || 'Programme'}</span>
            <h1 className="font-display text-2xl font-semibold text-stone-950 mt-3 user-text">{batch.name}</h1>
            <p className="text-sm text-stone-600 mt-1">
              {hasStarted ? 'Started' : 'Starts'} {formatDateDisplay(batch.start_date, organisation.timezone)}
              {practice ? ` · ${durationDays} days` : ''}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold shrink-0">{statusLabel}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing(true)} className="ui-btn-ghost">
            <Pencil className="w-4 h-4" /> Edit batch
          </button>
          <button type="button" onClick={loadData} disabled={loading} className="ui-btn-ghost">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 text-sm text-red-700 flex items-center justify-between gap-3">
          <span>This batch could not be loaded. {loadError}</span>
          <button type="button" onClick={loadData} className="ui-btn-ghost !min-h-9 !py-1.5 shrink-0">
            Try again
          </button>
        </div>
      )}

      {/* Counts for today (SPEC: "counts for today"); practice programmes only */}
      {practice && (
        <section className="space-y-2" aria-label="Counts for today">
          <h2 className="text-sm font-semibold text-stone-700">
            {!hasStarted ? 'Not started yet' : isFinished ? `Last day (day ${durationDays})` : `Today (day ${currentDay})`}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Morning', value: summaryCounts.morning, tone: 'text-amber-700' },
              { label: 'Evening', value: summaryCounts.evening, tone: 'text-indigo-700' },
              { label: 'No tick', value: summaryCounts.none, tone: 'text-stone-600' },
              { label: 'Quiet', value: summaryCounts.quiet, tone: 'text-red-700' },
            ].map((card) => (
              <div key={card.label} className="ui-card !p-3 text-center">
                <div className={`text-sm font-semibold ${card.tone}`}>{card.label}</div>
                <div className="text-2xl font-bold text-stone-950">{card.value}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-stone-600">Quiet means no tick for 4 days or more in a row.</p>
        </section>
      )}

      {/* Follow-ups of this batch (Phase 7) */}
      <BatchFollowups batch={batch} currentDay={currentDay} enrolments={enrolments} timeZone={organisation.timezone} />

      <section className="ui-card space-y-3">
        <h2 className="font-display text-lg font-semibold text-stone-950">Invite students</h2>
        <p className="text-sm text-stone-600">Share the join code or QR code, or add students by email.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-stone-100 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-widest text-center text-stone-950 select-all">
            {batch.join_code}
          </div>
          <button type="button" onClick={handleCopyCode} className="ui-btn-ghost shrink-0">
            {copiedCode ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowQR(!showQR)} aria-expanded={showQR} className="ui-btn-ghost">
            <QrCode className="w-4 h-4" />
            <span>{showQR ? 'Hide QR code' : 'Show QR code'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setInviteResult(null);
              setShowInviteModal(true);
            }}
            className="ui-btn-primary"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add by email</span>
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
      </section>

      <section className="ui-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
            <Users className="w-5 h-5 text-stone-600" />
            Students ({studentMetrics.length})
          </h2>
          <label className="flex items-center gap-1.5 text-sm text-stone-600">
            <ArrowUpDown className="w-4 h-4" />
            <span className="sr-only">Sort students</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="min-h-10 bg-white border border-stone-300 rounded-xl px-2.5 text-sm text-stone-800 cursor-pointer"
            >
              {practice && <option value="quiet">Quiet first</option>}
              {practice && <option value="streak">Longest streak first</option>}
              <option value="name">Name (A to Z)</option>
              {practice && <option value="status">Ticked today first</option>}
            </select>
          </label>
        </div>

        {studentMetrics.length === 0 ? (
          <p className="text-sm text-stone-600 py-2">No students yet. Share the join code above to invite them.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {sortedRoster.map(({ enrolment: enr, todayMorning, todayEvening, streak, isQuiet, practisedCount, lateCount, lastCheckinDay, lastCheckinStatus, lastCheckinAt }) => {
              const name = enr.student?.full_name || enr.student?.email || 'Student';
              const email = enr.student?.email;
              const lessonsDone = lessonIds.filter((id) => lessonProgress.get(enr.student_id)?.has(id)).length;
              return (
                <li key={enr.id} className="py-3.5 flex items-start gap-3">
                  <Avatar name={name} url={enr.student?.avatar_url} size={40} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span dir="auto" className="font-semibold text-base text-stone-950 user-text">{name}</span>
                      {isQuiet && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Quiet
                        </span>
                      )}
                    </div>
                    {practice && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
                        <span className="inline-flex items-center gap-1" aria-label={`Today: ${ticksLabel(todayMorning, todayEvening)}`}>
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${todayMorning ? 'bg-amber-400 text-stone-900' : 'bg-stone-100 text-stone-400'}`}
                            aria-hidden="true"
                          >
                            <Sun className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center ${todayEvening ? 'bg-indigo-600 text-white' : 'bg-stone-100 text-stone-400'}`}
                            aria-hidden="true"
                          >
                            <Moon className="w-3.5 h-3.5" />
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Flame className={`w-4 h-4 ${streak > 0 ? 'text-amber-500 fill-amber-500' : 'text-stone-400'}`} aria-hidden="true" />
                          {streak} day streak
                        </span>
                      </div>
                    )}
                    {practice && (
                      <p className="text-sm text-stone-600">
                        Last practice:{' '}
                        {lastCheckinDay
                          ? `day ${lastCheckinDay} (${lastCheckinStatus})${lastCheckinAt ? `, ${formatShortDate(lastCheckinAt, organisation.timezone)}` : ''}`
                          : 'none yet'}
                        {' · '}
                        {practisedCount} day{practisedCount === 1 ? '' : 's'} in total
                        {lateCount > 0 ? ` (${lateCount} added later)` : ''}
                      </p>
                    )}
                    {lessonIds.length > 0 && (
                      <p className="text-sm text-stone-600">
                        Lessons: {lessonsDone} of {lessonIds.length}
                      </p>
                    )}
                  </div>
                  {email && (
                    <a href={`mailto:${email}`} className="ui-icon-btn shrink-0" aria-label={`Email ${name}`} title={email}>
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="ui-card space-y-3">
        <h2 className="font-display text-lg font-semibold text-stone-950 flex items-center gap-2">
          <Mail className="w-5 h-5 text-stone-600" />
          Invited by email ({invites.length})
        </h2>
        {invites.length === 0 ? (
          <p className="text-sm text-stone-600">Nobody invited by email yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {invites.map((inv) => (
              <li key={inv.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                <span className="text-stone-800 truncate">{inv.email}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                    inv.claimed_by ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {inv.claimed_by ? 'Joined' : 'Not signed in yet'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Add students by email"
        description={`Anyone who already has an account in ${organisation.app_name} joins straight away. Everyone else joins when they first sign in.`}
        busy={isSubmittingInvites}
        footer={
          <>
            <button type="button" onClick={() => setShowInviteModal(false)} className="ui-btn-ghost">
              {inviteResult ? 'Done' : 'Cancel'}
            </button>
            <button type="submit" form="batch-invites" disabled={isSubmittingInvites || !emailText.trim()} className="ui-btn-primary">
              {isSubmittingInvites ? 'Adding...' : 'Add students'}
            </button>
          </>
        }
      >
        <form id="batch-invites" onSubmit={handleAddInvites} className="space-y-3">
          <label className="ui-label" htmlFor="invite-emails">
            Email addresses (one per line, or separated by commas)
          </label>
          <textarea
            id="invite-emails"
            rows={6}
            required
            placeholder={'alice@example.com\nbob@example.com'}
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            className="ui-input"
          />
          {inviteResult && (
            <p role="status" className="p-3 bg-emerald-50 rounded-xl text-sm text-emerald-900">
              {inviteResult}
            </p>
          )}
        </form>
      </Sheet>
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
