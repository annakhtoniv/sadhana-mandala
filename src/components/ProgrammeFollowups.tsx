import React, { useEffect, useState } from 'react';
import { fetchFollowupPlan, fetchMyBatchSessions } from '../lib/followupService';
import { activeReminders } from '../lib/followupUtils';
import type { BatchSession, FollowupStep } from '../types/database';
import { formatSessionTime } from './BatchFollowups';
import { Bell, CalendarClock, MapPin } from 'lucide-react';
import { useT } from '../i18n';

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
  const t = useT();
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
          className="p-4 rounded-2xl border border-amber-200 bg-amber-50 flex gap-3">
          <Bell className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-base font-semibold text-amber-900 user-text">{r.title}</div>
            {r.description && <div className="text-sm text-amber-900 user-text">{r.description}</div>}
          </div>
        </div>
      ))}

      {coming.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-emerald-700" />
            <h2 className="font-display text-lg font-semibold text-stone-950">{t('followups.title')}</h2>
          </div>
          <div className="divide-y divide-stone-100">
            {coming.map((s) => (
              <div key={s.step_id} className="py-2.5 space-y-0.5">
                <div className="text-base font-medium text-stone-900 user-text">{s.title}</div>
                {s.status === 'scheduled' && s.scheduled_for ? (
                  <div className="text-sm text-stone-700">{formatSessionTime(s.scheduled_for, timeZone)}</div>
                ) : (
                  <div className="text-sm text-stone-600">{t('followups.aroundDay', { day: s.offset_day })}</div>
                )}
                {s.status === 'scheduled' && s.location && (
                  <div className="inline-flex items-center gap-1 text-sm text-stone-600">
                    <MapPin className="w-3 h-3" />
                    {/^https:\/\//i.test(s.location) ? (
                      <a href={s.location} target="_blank" rel="noopener noreferrer" className="underline text-emerald-700">
                        {t('followups.joinOnline')}
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
