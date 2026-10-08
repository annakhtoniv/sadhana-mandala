import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchBatchEnrolments, fetchBatchInvites, addBatchInvites } from '../lib/batchService';
import { fetchBatchAllCheckins } from '../lib/checkinService';
import { formatDateDisplay, calculateDayNumber } from '../lib/dateUtils';
import { calculateStreak, isQuietStudent } from '../lib/practiceUtils';
import type { Batch, Enrolment, BatchInvite, Organisation, Checkin } from '../types/database';
import {
  ArrowLeft,
  UserPlus,
  Users,
  QrCode,
  Copy,
  Check,
  X,
  Mail,
  RefreshCw,
  Sparkles,
  Flame,
  VolumeX,
  CheckCircle2,
  Moon,
  XCircle,
} from 'lucide-react';

interface TeacherBatchDetailProps {
  batch: Batch;
  organisation: Organisation;
  onBack: () => void;
}

export const TeacherBatchDetail: React.FC<TeacherBatchDetailProps> = ({
  batch,
  organisation,
  onBack,
}) => {
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  const [invites, setInvites] = useState<BatchInvite[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [isSubmittingInvites, setIsSubmittingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const durationDays = batch.course?.duration_days || 40;
  const currentDay = calculateDayNumber(batch.start_date, organisation.timezone);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enrList, invList, chkList] = await Promise.all([
        fetchBatchEnrolments(batch.id),
        fetchBatchInvites(batch.id),
        fetchBatchAllCheckins(batch.id),
      ]);
      setEnrolments(enrList);
      setInvites(invList);
      setCheckins(chkList);
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

  const joinUrl = `${window.location.origin}?code=${batch.join_code}`;

  // Checkin & Cohort Metrics for Today
  const todayCheckins = checkins.filter((c) => c.day_number === currentDay);
  const doneCount = todayCheckins.filter((c) => c.status === 'done').length;
  const restCount = todayCheckins.filter((c) => c.status === 'rest').length;
  const notYetCount = todayCheckins.filter((c) => c.status === 'not_yet').length;

  // Quiet students count (Per SPEC: no check-in of any kind for 4 consecutive days)
  const quietStudentsCount = enrolments.filter((enr) => {
    const studentCheckins = checkins.filter((c) => c.student_id === enr.student_id);
    return isQuietStudent(studentCheckins, currentDay);
  }).length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Top back navigation */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to My Batches</span>
      </button>

      {/* Batch Header */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            {batch.course?.name || 'Sadhana Course'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[11px] font-mono font-medium">
            {currentDay < 1
              ? `Starts in ${Math.abs(currentDay - 1)} days`
              : currentDay <= durationDays
              ? `Day ${currentDay} of ${durationDays}`
              : `Day ${durationDays} (Finished)`}
          </span>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
            {batch.name}
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Start Date: {formatDateDisplay(batch.start_date, organisation.timezone)} &bull; {durationDays} Days Commitment
          </p>
        </div>

        {/* Join Code & QR Action Bar */}
        <div className="pt-2 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
            <span className="text-[11px] text-stone-500">Join Code:</span>
            <span className="font-mono font-bold text-sm text-stone-900 dark:text-stone-100 tracking-wider">
              {batch.join_code}
            </span>
            <button
              type="button"
              onClick={handleCopyCode}
              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              title="Copy Join Code"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowQR(!showQR)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>{showQR ? 'Hide QR' : 'Show QR'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 active:scale-[0.99] cursor-pointer shadow-sm transition-all ml-auto"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student Emails</span>
          </button>
        </div>

        {/* QR Code Expansion */}
        {showQR && (
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-700 flex flex-col items-center gap-3 animate-in fade-in duration-150">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <QRCodeSVG value={joinUrl} size={160} level="M" />
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 text-center max-w-xs">
              Students can scan this QR code with their phone camera to join batch <strong>{batch.name}</strong>.
            </p>
          </div>
        )}
      </div>

      {/* Today's Counts Summary (Per SPEC: "Batch detail (counts for today, roster with today's status, streak, last check-in and a Quiet flag)") */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Done Today</span>
          </div>
          <div className="text-xl font-bold text-stone-900 dark:text-stone-100">
            {doneCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5 text-indigo-500" />
            <span>Rest Day</span>
          </div>
          <div className="text-xl font-bold text-stone-900 dark:text-stone-100">
            {restCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Not Yet</span>
          </div>
          <div className="text-xl font-bold text-stone-900 dark:text-stone-100">
            {notYetCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
            <VolumeX className="w-3.5 h-3.5" />
            <span>Quiet Flag</span>
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
            {quietStudentsCount}
          </div>
        </div>
      </div>

      {/* Enrolled Students Roster */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Enrolled Students ({enrolments.length})
            </h2>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            title="Refresh Roster"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {enrolments.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-stone-50 dark:bg-stone-800/30 border border-dashed border-stone-200 dark:border-stone-800 space-y-2">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              No students enrolled in this batch yet.
            </p>
            <p className="text-[11px] text-stone-400">
              Paste student emails or share join code <strong>{batch.join_code}</strong>.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {enrolments.map((enr) => {
              const studentCheckins = checkins.filter((c) => c.student_id === enr.student_id);
              const streak = calculateStreak(studentCheckins, currentDay);
              const isQuiet = isQuietStudent(studentCheckins, currentDay);
              const todayRecord = studentCheckins.find((c) => c.day_number === currentDay);
              const todayStatus = todayRecord?.status;

              return (
                <div key={enr.id} className="py-3 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-900 dark:text-stone-100 truncate">
                        {enr.student?.full_name || 'Practitioner'}
                      </span>
                      {isQuiet && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 shrink-0 flex items-center gap-1">
                          <VolumeX className="w-2.5 h-2.5" />
                          <span>Quiet</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">{enr.student?.email}</div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Today's Status */}
                    {todayStatus === 'done' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Done</span>
                      </span>
                    ) : todayStatus === 'rest' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900 flex items-center gap-1">
                        <Moon className="w-3 h-3" />
                        <span>Rest</span>
                      </span>
                    ) : todayStatus === 'not_yet' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 flex items-center gap-1">
                        <X className="w-3 h-3" />
                        <span>Not Yet</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 border border-stone-200 dark:border-stone-700">
                        Pending
                      </span>
                    )}

                    {/* Streak Count */}
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 text-[10px] font-bold">
                      <Flame className="w-3 h-3" />
                      <span>{streak}d</span>
                    </div>
                  </div>
                </div>
              );
            })}
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

      {/* Add Emails Modal (Per SPEC: "the teacher pastes student emails into a batch. A matching email is enrolled automatically.") */}
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
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteResult(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvites || !emailText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-stone-900 dark:bg-stone-100 text-stone-100 dark:text-stone-900 text-xs font-semibold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingInvites ? 'Saving...' : 'Add & Enrol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
