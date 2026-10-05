import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Lesson } from '../types/database';
import { BookOpen, ChevronRight, ArrowLeft, Video } from 'lucide-react';

interface LessonsScreenProps {
  onBack: () => void;
}

export const LessonsScreen: React.FC<LessonsScreenProps> = ({ onBack }) => {
  const { organisation } = useAuth();
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
          className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Lessons</span>
        </button>

        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="space-y-1">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              {selectedLesson.scope} {selectedLesson.day_number ? `• Day ${selectedLesson.day_number}` : ''}
            </span>
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
              {selectedLesson.title}
            </h1>
          </div>

          {selectedLesson.video_url && (
            <div className="p-3 bg-stone-100 dark:bg-stone-800 rounded-xl flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              <Video className="w-4 h-4 text-emerald-500" />
              <span>Video accompaniment available</span>
            </div>
          )}

          <div className="text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line prose dark:prose-invert">
            {selectedLesson.body}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <BookOpen className="w-4 h-4" />
          <span>Daily Wisdom & Guidance</span>
        </div>
        <h1 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
          Practice Lessons
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Inspirational guidance, technique reminders, and cohort reflections to nurture your daily sadhana.
        </p>
      </div>

      {/* Lessons List */}
      <div className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Available Lessons ({lessons.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-xs text-stone-400">Loading lessons...</div>
        ) : lessons.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-stone-50 dark:bg-stone-800/30 border border-dashed border-stone-200 dark:border-stone-800 space-y-2">
            <p className="text-xs text-stone-500 dark:text-stone-400">No lessons published yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {lessons.map((lesson) => (
              <button
                type="button"
                key={lesson.id}
                onClick={() => setSelectedLesson(lesson)}
                className="w-full py-3.5 flex items-center justify-between text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-2 transition-colors cursor-pointer group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-stone-900 dark:text-stone-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {lesson.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-stone-400">
                    <span className="capitalize">{lesson.scope} Scope</span>
                    {lesson.day_number && (
                      <>
                        <span>&bull;</span>
                        <span>Day {lesson.day_number}</span>
                      </>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
        >
          &larr; Back to Home
        </button>
      </div>
    </div>
  );
};
