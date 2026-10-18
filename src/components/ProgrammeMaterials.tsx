import React, { useEffect, useState } from 'react';
import { fetchMaterials, formatBytes, materialUrl } from '../lib/materialsService';
import type { Course, MaterialKind, ProgrammeMaterial } from '../types/database';
import { ExternalLink, FileAudio, FileImage, FileText, FileVideo, Folder, Link2, Loader2, Paperclip } from 'lucide-react';

const ICONS: Record<MaterialKind, { icon: React.ElementType; tone: string }> = {
  pdf: { icon: FileText, tone: 'bg-red-50 text-red-600' },
  audio: { icon: FileAudio, tone: 'bg-violet-50 text-violet-600' },
  video: { icon: FileVideo, tone: 'bg-sky-50 text-sky-600' },
  image: { icon: FileImage, tone: 'bg-amber-50 text-amber-600' },
  file: { icon: Paperclip, tone: 'bg-stone-100 text-stone-600' },
  link: { icon: Link2, tone: 'bg-emerald-50 text-emerald-600' },
};

export const MaterialIcon: React.FC<{ kind: MaterialKind }> = ({ kind }) => {
  const { icon: Icon, tone } = ICONS[kind] || ICONS.file;
  return (
    <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${tone}`}>
      <Icon className="w-[18px] h-[18px]" />
    </span>
  );
};

/** Study materials of the student's programme: tap to open, audio and video play here. */
export const ProgrammeMaterials: React.FC<{ course: Course }> = ({ course }) => {
  const [items, setItems] = useState<ProgrammeMaterial[]>([]);
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchMaterials(course.id)
      .then((list) => setItems(list.filter((m) => m.published)))
      .catch(() => setItems([]));
  }, [course.id]);

  if (items.length === 0) return null;

  const open = async (m: ProgrammeMaterial) => {
    setError(null);
    if (m.kind === 'audio' || m.kind === 'video') {
      if (playing?.id === m.id) {
        setPlaying(null);
        return;
      }
      setOpening(m.id);
      const url = await materialUrl(m);
      setOpening(null);
      if (url) setPlaying({ id: m.id, url });
      else setError('This file could not be opened. Please tell your teacher.');
      return;
    }
    // Open the tab first (phones block pop-ups opened after a wait), then point it at the file
    const tab = window.open('', '_blank');
    setOpening(m.id);
    const url = await materialUrl(m);
    setOpening(null);
    if (url && tab) {
      tab.opener = null; // the opened page cannot reach back into the app
      tab.location.href = url;
    }
    else {
      tab?.close();
      setError('This file could not be opened. Please tell your teacher.');
    }
  };

  return (
    <section className="ui-card space-y-3">
      <div className="flex items-center gap-2">
        <Folder className="w-5 h-5 text-emerald-700" />
        <h2 className="font-display text-lg font-semibold text-stone-950">Study materials</h2>
        <span className="text-sm text-stone-600">({items.length})</span>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <ul className="space-y-1.5">
        {(showAll ? items : items.slice(0, 3)).map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => open(m)}
              className="w-full min-h-14 flex items-center gap-3 p-2 -mx-2 rounded-2xl hover:bg-stone-50 text-start cursor-pointer"
            >
              <MaterialIcon kind={m.kind} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-stone-900 truncate">{m.title}</span>
                <span className="block text-sm text-stone-600 truncate">
                  {m.description ||
                    (m.kind === 'link'
                      ? 'Link'
                      : [m.kind === 'pdf' ? 'PDF' : m.kind.charAt(0).toUpperCase() + m.kind.slice(1), formatBytes(m.size_bytes)].filter(Boolean).join(' · '))}
                </span>
              </span>
              {opening === m.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-stone-500 shrink-0" />
              ) : (
                <ExternalLink className="w-4 h-4 text-stone-500 shrink-0" aria-hidden="true" />
              )}
            </button>
            {playing?.id === m.id &&
              (m.kind === 'audio' ? (
                <audio src={playing.url} controls autoPlay className="w-full mt-1" />
              ) : (
                <video src={playing.url} controls autoPlay playsInline className="w-full mt-1 rounded-2xl bg-black" />
              ))}
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll} className="ui-btn-ghost w-full">
          {showAll ? 'Show fewer' : `See all ${items.length} materials`}
        </button>
      )}
    </section>
  );
};
