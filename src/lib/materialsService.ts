import { friendlyError } from './errors';
import { supabase, isDemoMode } from './supabase';
import type { MaterialKind, ProgrammeMaterial } from '../types/database';

const BUCKET = 'materials';
/** The bucket accepts files up to 20 MB (Phase 14: keeps the 1 GB free storage from filling up). */
export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;
const DEMO_ERROR = 'Not available with sample data.';

export function kindForMime(mime: string, fileName = ''): MaterialKind {
  if (mime === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return 'file';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Turns "My notes (v2).pdf" into "my-notes-v2.pdf" for the storage path. */
export function safeFileName(fullName: string): string {
  const name = fullName.split(/[\\/]/).pop() || fullName;
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) : '';
  return ext ? `${base}.${ext}` : base;
}

export function titleFromFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, ' ').trim() || name;
}

/** Materials of a programme (staff: all; students: published, programmes they are in). */
export async function fetchMaterials(courseId: string): Promise<ProgrammeMaterial[]> {
  if (isDemoMode()) return [];
  const { data, error } = await supabase
    .from('programme_materials')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data as ProgrammeMaterial[]) || [];
}

type Result = { success: boolean; error?: string };

export async function uploadMaterial(
  orgId: string,
  courseId: string,
  userId: string,
  file: File,
  title: string,
  sortOrder: number
): Promise<Result> {
  if (isDemoMode()) return { success: false, error: DEMO_ERROR };
  if (file.size > MAX_MATERIAL_BYTES) {
    return { success: false, error: `"${file.name}" is ${formatBytes(file.size)}. The limit is 20 MB; for longer videos add a YouTube link instead.` };
  }
  // SVG pictures can carry scripts, so they are not accepted
  if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    return { success: false, error: `"${file.name}" is an SVG picture, which cannot be uploaded. Please use JPEG or PNG.` };
  }
  const path = `${orgId}/${courseId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (upErr) return { success: false, error: friendlyError(upErr) };
  const { error } = await supabase.from('programme_materials').insert({
    org_id: orgId,
    course_id: courseId,
    title: title.trim() || titleFromFileName(file.name),
    kind: kindForMime(file.type, file.name),
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
    sort_order: sortOrder,
    created_by: userId,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { success: false, error: friendlyError(error) };
  }
  return { success: true };
}

export async function addMaterialLink(
  orgId: string,
  courseId: string,
  userId: string,
  title: string,
  url: string,
  sortOrder: number
): Promise<Result> {
  if (isDemoMode()) return { success: false, error: DEMO_ERROR };
  if (!title.trim()) return { success: false, error: 'Please enter a title.' };
  if (!/^https:\/\/\S+$/i.test(url.trim())) return { success: false, error: 'Links must start with https://' };
  const { error } = await supabase.from('programme_materials').insert({
    org_id: orgId,
    course_id: courseId,
    title: title.trim(),
    kind: 'link',
    url: url.trim(),
    sort_order: sortOrder,
    created_by: userId,
  });
  return error ? { success: false, error: friendlyError(error) } : { success: true };
}

export async function updateMaterial(id: string, patch: Partial<Pick<ProgrammeMaterial, 'title' | 'description' | 'published' | 'sort_order'>>): Promise<Result> {
  if (isDemoMode()) return { success: false, error: DEMO_ERROR };
  const { error } = await supabase.from('programme_materials').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  return error ? { success: false, error: friendlyError(error) } : { success: true };
}

export async function deleteMaterial(m: ProgrammeMaterial): Promise<Result> {
  if (isDemoMode()) return { success: false, error: DEMO_ERROR };
  const { error } = await supabase.from('programme_materials').delete().eq('id', m.id);
  if (error) return { success: false, error: friendlyError(error) };
  if (m.storage_path) {
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([m.storage_path]);
    // The list entry is gone; tell the person the file itself may still take space
    if (rmErr) return { success: true, error: 'Removed from the list, but the file could not be deleted from storage.' };
  }
  return { success: true };
}

/** A temporary link (1 hour) to open or play a file. */
export async function materialUrl(m: ProgrammeMaterial): Promise<string | null> {
  if (m.kind === 'link') return m.url;
  if (!m.storage_path || isDemoMode()) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(m.storage_path, 3600);
  if (error) return null;
  return data.signedUrl;
}
