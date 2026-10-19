import React, { useState } from 'react';
import { calculateDayNumber, formatDateRange } from '../lib/dateUtils';
import { hasPracticeTrack, programmeRunStatus } from '../lib/programmeUtils';
import type { Batch } from '../types/database';
import { Avatar } from './Avatar';
import { Check, ChevronRight, Copy, QrCode } from 'lucide-react';

interface BatchCardProps {
  batch: Batch;
  timeZone: string;
  onOpen: () => void;
  onShowQr: () => void;
}

/** Where a batch is: shown on the card and used to group the list. */
export function batchPhase(batch: Batch, timeZone: string): 'running' | 'upcoming' | 'finished' {
  const status = programmeRunStatus(batch.course, calculateDayNumber(batch.start_date, timeZone));
  return status === 'upcoming' ? 'upcoming' : status === 'completed' ? 'finished' : 'running';
}

/** A batch in the admin list. The whole card opens the batch. */
export const BatchCard: React.FC<BatchCardProps> = ({ batch, timeZone, onOpen, onShowQr }) => {
  const [copied, setCopied] = useState(false);
  const day = calculateDayNumber(batch.start_date, timeZone);
  const practice = hasPracticeTrack(batch.course);
  const total = practice ? batch.course?.duration_days || 40 : batch.course?.programme_days || null;
  const phase = batchPhase(batch, timeZone);
  const pct = total ? Math.min(100, Math.max(0, Math.round((Math.min(day, total) / total) * 100))) : null;

  const status =
    phase === 'upcoming'
      ? `Starts in ${1 - day} day${1 - day === 1 ? '' : 's'}`
      : phase === 'finished'
      ? 'Finished'
      : total
      ? `Day ${day} of ${total}`
      : `Day ${day}`;
  const tone =
    phase === 'running'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/15'
      : phase === 'upcoming'
      ? 'bg-sky-50 text-sky-700 ring-sky-600/15'
      : 'bg-stone-100 text-stone-500 ring-stone-900/5';

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(batch.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group ui-card !p-0 overflow-hidden text-left cursor-pointer transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      aria-label={`Open ${batch.name}`}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-stone-500 truncate">{batch.course?.name || 'Programme'}</span>
          <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${tone}`}>{status}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-[17px] font-semibold text-stone-950 leading-snug truncate">{batch.name}</h3>
          <ChevronRight className="w-4 h-4 text-stone-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-stone-600" />
        </div>

        {pct !== null && phase !== 'upcoming' ? (
          <div className="h-1 rounded-full bg-stone-100 overflow-hidden" aria-hidden="true">
            <div
              className={`h-full rounded-full ${phase === 'finished' ? 'bg-stone-300' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}
        <div className="text-xs text-stone-500">
          {formatDateRange(batch.start_date, batch.end_date, timeZone)}
          {practice ? ` · ${batch.course?.practice_name || `${total}-day practice`}` : ''}
        </div>
      </div>

      <div className="px-4 py-3 bg-stone-50/70 border-t border-stone-900/[0.05] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Avatar name={batch.teacher?.full_name || batch.teacher?.email} url={batch.teacher?.avatar_url} size={24} />
          <span className="text-xs text-stone-600 truncate">{batch.teacher?.full_name || batch.teacher?.email || 'Teacher'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={copy}
            title="Copy join code"
            className="h-8 px-2.5 rounded-full bg-white ring-1 ring-stone-900/10 text-xs font-mono font-semibold text-stone-700 flex items-center gap-1.5 hover:bg-stone-50 cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : batch.join_code}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShowQr();
            }}
            title="View QR Code"
            className="h-8 w-8 rounded-full bg-white ring-1 ring-stone-900/10 text-stone-700 flex items-center justify-center hover:bg-stone-50 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
