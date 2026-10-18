import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  addMaterialLink,
  deleteMaterial,
  fetchMaterials,
  formatBytes,
  materialUrl,
  titleFromFileName,
  updateMaterial,
  uploadMaterial,
} from '../lib/materialsService';
import type { Course, ProgrammeMaterial } from '../types/database';
import { MaterialIcon } from './ProgrammeMaterials';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Link2, Loader2, Trash2, Upload } from 'lucide-react';

interface MaterialsEditorProps {
  course: Course;
  onBack: () => void;
}

const inputClass = 'w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-900 focus:outline-none';

/**
 * Study materials of one programme (PDF, audio, video, images, files, links).
 * They are shared by every batch of the programme.
 */
export const MaterialsEditor: React.FC<MaterialsEditorProps> = ({ course, onBack }) => {
  const { organisation, user } = useAuth();
  const [items, setItems] = useState<ProgrammeMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [link, setLink] = useState({ title: '', url: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      setItems(await fetchMaterials(course.id));
    } catch (err) {
      setMessage({ tone: 'error', text: `Could not load materials: ${err instanceof Error ? err.message : 'unknown error'}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [course.id]);

  const nextOrder = () => (items.length ? Math.max(...items.map((m) => m.sort_order)) + 10 : 10);

  const onFiles = async (files: FileList | null) => {
    if (!files || !user) return;
    setMessage(null);
    let order = nextOrder();
    let done = 0;
    for (const file of Array.from(files)) {
      setBusy(`Uploading ${file.name}...`);
      const res = await uploadMaterial(organisation.id, course.id, user.id, file, titleFromFileName(file.name), order);
      order += 10;
      if (!res.success) {
        setMessage({ tone: 'error', text: res.error || `Could not upload ${file.name}.` });
        break;
      }
      done += 1;
    }
    setBusy(null);
    if (done > 0) setMessage({ tone: 'ok', text: `${done} file${done === 1 ? '' : 's'} added. Every batch of ${course.name} can see ${done === 1 ? 'it' : 'them'} now.` });
    await load();
  };

  const onAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy('Adding link...');
    const res = await addMaterialLink(organisation.id, course.id, user.id, link.title, link.url, nextOrder());
    setBusy(null);
    if (!res.success) {
      setMessage({ tone: 'error', text: res.error || 'Could not add the link.' });
      return;
    }
    setLink({ title: '', url: '' });
    setMessage({ tone: 'ok', text: 'Link added.' });
    await load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    const other = items[index + dir];
    const item = items[index];
    if (!other) return;
    setBusy('Saving order...');
    await updateMaterial(item.id, { sort_order: other.sort_order });
    await updateMaterial(other.id, { sort_order: item.sort_order });
    setBusy(null);
    await load();
  };

  const rename = async (m: ProgrammeMaterial, title: string) => {
    if (!title.trim() || title === m.title) return;
    await updateMaterial(m.id, { title: title.trim() });
    await load();
  };

  return (
    <div className="w-full space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 cursor-pointer">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Programmes
      </button>

      <section className="ui-card space-y-4">
        <div>
          <span className="ui-eyebrow">Study materials</span>
          <h1 className="font-display text-xl font-semibold text-stone-950 mt-2">{course.name}</h1>
          <p className="text-xs text-stone-500 mt-1">
            PDFs, audio, videos, pictures and links. Every batch of this programme sees them, now and in future batches.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="w-full rounded-[1.25rem] border-2 border-dashed border-stone-300 hover:border-emerald-500 hover:bg-emerald-50/40 p-6 flex flex-col items-center gap-2 text-center transition-colors cursor-pointer disabled:opacity-60"
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin text-stone-500" /> : <Upload className="w-6 h-6 text-stone-500" />}
          <span className="text-sm font-semibold text-stone-800">{busy || 'Upload files'}</span>
          <span className="text-[11px] text-stone-500">PDF, audio (MP3), video (MP4), pictures or documents. Up to 20 MB each. Longer videos: add a YouTube link instead.</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="application/pdf,audio/*,video/*,image/jpeg,image/png,image/webp,image/gif,.doc,.docx,.ppt,.pptx,.txt"
          className="sr-only"
          onChange={(e) => {
            onFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <form onSubmit={onAddLink} className="space-y-2">
          <div className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Or add a link (YouTube, Google Drive, a website)
          </div>
          <input className={inputClass} placeholder="Title" value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} />
          <div className="flex gap-2">
            <input className={inputClass} placeholder="https://" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} />
            <button type="submit" disabled={busy !== null || !link.url.trim()} className="ui-btn-primary !py-2.5 !px-4 shrink-0">
              Add
            </button>
          </div>
        </form>

        {message && (
          <p role="status" className={`text-xs ${message.tone === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
      </section>

      <section className="ui-card space-y-1">
        <h2 className="text-sm font-semibold text-stone-900 pb-1">
          In this programme <span className="text-stone-400 font-normal">{items.length}</span>
        </h2>
        {loading && <p className="text-xs text-stone-400">Loading...</p>}
        {!loading && items.length === 0 && <p className="text-xs text-stone-400">Nothing yet. Upload the first file above.</p>}
        <ul className="divide-y divide-stone-100">
          {items.map((m, i) => (
            <li key={m.id} className={`py-3 flex items-center gap-3 ${m.published ? '' : 'opacity-60'}`}>
              <MaterialIcon kind={m.kind} />
              <div className="min-w-0 flex-1">
                <input
                  defaultValue={m.title}
                  aria-label="Title"
                  onBlur={(e) => rename(m, e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-stone-900 focus:outline-none focus:bg-stone-50 rounded px-1 -mx-1"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const url = await materialUrl(m);
                    if (url) window.open(url, '_blank', 'noopener');
                  }}
                  className="text-[11px] text-stone-500 hover:underline cursor-pointer"
                >
                  {m.kind === 'link' ? m.url : [m.kind.toUpperCase(), formatBytes(m.size_bytes)].filter(Boolean).join(' · ')}
                  {!m.published && ' · hidden from students'}
                </button>
              </div>
              <div className="flex items-center shrink-0">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="ui-icon-btn !w-8 !h-8 disabled:opacity-30" aria-label="Move up">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="ui-icon-btn !w-8 !h-8 disabled:opacity-30" aria-label="Move down">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await updateMaterial(m.id, { published: !m.published });
                    await load();
                  }}
                  className="ui-icon-btn !w-8 !h-8"
                  aria-label={m.published ? 'Hide from students' : 'Show to students'}
                  title={m.published ? 'Hide from students' : 'Show to students'}
                >
                  {m.published ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm(`Delete "${m.title}"? Students will no longer see it.`)) return;
                    const res = await deleteMaterial(m);
                    if (!res.success || res.error) setMessage({ tone: 'error', text: res.error || 'Could not delete.' });
                    await load();
                  }}
                  className="ui-icon-btn !w-8 !h-8 hover:!text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};
