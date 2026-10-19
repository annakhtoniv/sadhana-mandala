import React, { useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { useT } from '../i18n';
import { fetchUnreadEncouragements, markEncouragementSeen, type Encouragement } from '../lib/engagementService';

/** Phase 22: messages a teacher sent from the batch page, until the student says thank you. */
export const EncouragementCard: React.FC<{ userId: string }> = ({ userId }) => {
  const t = useT();
  const [items, setItems] = useState<Encouragement[]>([]);

  useEffect(() => {
    fetchUnreadEncouragements(userId).then(setItems).catch(() => setItems([]));
  }, [userId]);

  if (items.length === 0) return null;
  const n = items[0];
  const teacher = n.from?.full_name || '';
  return (
    <section role="status" className="ui-card !p-4 space-y-2 bg-emerald-50/60 ring-1 ring-emerald-200 animate-fade-up">
      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
        <HeartHandshake className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="user-text">{teacher ? t('encourage.title', { teacher }) : t('encourage.titleTeacher')}</span>
      </div>
      <p className="text-base text-stone-800 user-text" dir="auto">{n.message}</p>
      <button
        type="button"
        onClick={async () => {
          await markEncouragementSeen(n.id).catch(() => {});
          setItems((list) => list.slice(1));
        }}
        className="ui-btn-ghost !min-h-10 !py-2 !px-4"
      >
        {t('encourage.thanks')}
      </button>
    </section>
  );
};
