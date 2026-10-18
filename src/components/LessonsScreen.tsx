import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Lesson } from '../types/database';
import { BookOpen, ChevronRight, ArrowLeft, Video } from 'lucide-react';
import { useT } from '../i18n';

interface LessonsScreenProps {
  onBack: () => void;
}

export const LessonsScreen: React.FC<LessonsScreenProps> = ({ onBack }) => {
  const { organisation } = useAuth();
  const t = useT();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    async function loadLessons() {
      if (!organisation.id) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('lessons')
          .select('*')
          .eq('org_id', organisation.id)
          .eq('published', true)
          // Module lessons live in each programme's Learning section (Phase 6)
          .is('module_id', null)
          .order('day_number', { ascending: true, nullsFirst: false });

        if (error) {
          console.warn('Error fetching lessons:', error.message);
        } else {
          setLessons((data as Lesson[]) || []);
        }
      } catch (err) {
        console.error('Failed to load lessons:', err);
      } finally {
        setLoading(false);
      }
    }

    loadLessons();
  }, [organisation.id]);

  if (selectedLesson) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-150">
        <button
          type="button"
          onClick={() => setSelectedLesson(null)}
          className="ui-btn-ghost !min-h-10 !py-2 !px-4"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('learn.back')}</span>
        </button>

        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider bg-emerald-50 text-emerald-600">
              {selectedLesson.day_number ? t('common.day', { day: selectedLesson.day_number }) : t('lessons.general')}
            </span>
            <h1 className="text-xl font-bold text-stone-900">
              {selectedLesson.title}
            </h1>
          </div>

          {selectedLesson.video_url && (
            <div className="p-3 bg-stone-100 rounded-xl flex items-center gap-2 text-xs text-stone-600">
              <Video className="w-4 h-4 text-emerald-500" />
              <span>{t('lessons.hasVideo')}</span>
            </div>
          )}

          <div className="text-base text-stone-700 leading-relaxed whitespace-pre-line prose user-text">
            {selectedLesson.body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-2">
        <span className="ui-eyebrow">
          <BookOpen className="w-3.5 h-3.5" /> {t('lessons.eyebrow')}
        </span>
        <h1 className="font-display text-2xl font-semibold text-stone-950 mt-2">{t('lessons.title')}</h1>
        <p className="text-base text-stone-600">{t('lessons.subtitle')}</p>
      </div>

      {/* Lessons List */}
      <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-stone-950">{t('lessons.available', { count: lessons.length })}</h2>
        </div>

        {loading ? (
          <div role="status" className="p-6 text-center text-sm text-stone-600">{t('common.loading')}</div>
        ) : lessons.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-stone-50 border border-dashed border-stone-200 space-y-2">
            <p className="text-base text-stone-600">{t('lessons.none')}</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {lessons.map((lesson) => (
              <button
                type="button"
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className="w-full min-h-14 py-3.5 flex items-center justify-between text-start hover:bg-stone-50 rounded-xl px-2 transition-colors cursor-pointer group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-base text-stone-900 group-hover:text-emerald-700 transition-colors user-text">
                      {lesson.title}
                    </span>
                  </div>
                  <div className="text-sm text-stone-600">
                    {lesson.day_number ? t('common.day', { day: lesson.day_number }) : t('lessons.general')}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-stone-500 rtl:rotate-180" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-center">
        <button type="button" onClick={onBack} className="ui-btn-ghost">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('lessons.backHome')}
        </button>
      </div>
    </div>
  );
};
