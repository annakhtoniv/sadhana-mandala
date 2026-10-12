import React, { useEffect, useState } from 'react';
import { fetchFollowupPlan, fetchMyBatchSessions } from '../lib/followupService';
import { activeReminders } from '../lib/followupUtils';
import type { BatchSession, FollowupStep } from '../types/database';
import { formatSessionTime } from './BatchFollowups';
import { Bell, CalendarClock, MapPin } from 'lucide-react';

interface ProgrammeFollowupsProps {
  batchId: string;
  courseId: string;
  dayNumber: number;
  timeZone: string;
}

/**
 * Student view of follow-ups (SPEC "Follow-ups"): today's practice reminders
 * and the batch's coming follow-up sessions (when and where; never notes).
 */
export const ProgrammeFollowups: React.FC<ProgrammeFollowupsProps> = ({ batchId, courseId, dayNumber, timeZone }) => {
  const [plan, setPlan] = useState<FollowupStep[]>([]);
  const [sessions, setSessions] = useState<BatchSession[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([fetchFollowupPlan(courseId), fetchMyBatchSessions(batchId)])
      .then(([steps, sess]) => {
        if (!active) return;
        setPlan(steps);
        setSessions(sess);
      })
      .catch((err) => console.warn('Could not load follow-ups:', err));
    return () => {
      active = false;
    };
  }, [batchId, courseId]);

  const reminders = activeReminders(plan, dayNumber);
  // Coming sessions: not held or skipped yet; scheduled ones and those still to be announced
  const coming = sessions.filter((s) => s.status !== 'done' && s.status !== 'skipped');

  if (reminders.length === 0 && coming.length === 0) return null;

  return (
    <>
      {reminders.map((r) => (
        <div key={r.id} role="status"
          className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 flex gap-3">
          <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-900 dark:text-amber-200">{r.title}</div>
            {r.description && <div className="text-xs text-amber-800 dark:text-amber-300">{r.description}</div>}
          </div>
        </div>
      ))}

      {coming.length > 0 && (
        <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Follow-up sessions</h2>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {coming.map((s) => (
              <div key={s.step_id} className="py-2.5 space-y-0.5">
                <div className="text-sm font-medium text-stone-900 dark:text-stone-100">{s.title}</div>
                {s.status === 'scheduled' && s.scheduled_for ? (
                  <div className="text-xs text-stone-600 dark:text-stone-300">{formatSessionTime(s.scheduled_for, timeZone)}</div>
                ) : (
                  <div className="text-xs text-stone-400">Around day {s.offset_day} · your teacher will share the time</div>
                )}
                {s.status === 'scheduled' && s.location && (
                  <div className="inline-flex items-center gap-1 text-xs text-stone-500">
                    <MapPin className="w-3 h-3" />
                    {/^https:\/\//i.test(s.location) ? (
                      <a href={s.location} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700 dark:text-emerald-400">
                        Join online
                      </a>
                    ) : (
                      s.location
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
