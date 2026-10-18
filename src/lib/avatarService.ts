import { supabase, isDemoMode } from './supabase';

const MAX_SIDE = 320;

/** Shrinks a photo to a small square JPEG (keeps uploads fast and under the 2 MB limit). */
async function toSquareJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('This file is not a picture we can read.'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = MAX_SIDE;
    canvas.height = MAX_SIDE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare the picture.');
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, MAX_SIDE, MAX_SIDE);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not prepare the picture.'))), 'image/jpeg', 0.86)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads a new profile picture to avatars/<user id>/ and shows it everywhere. */
export async function uploadAvatar(userId: string, file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  if (isDemoMode()) return { success: false, error: 'Not available with sample data.' };
  if (!file.type.startsWith('image/')) return { success: false, error: 'Please choose a photo (JPEG, PNG or WebP).' };
  try {
    const blob = await toSquareJpeg(file);
    const path = `${userId}/avatar-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (upErr) return { success: false, error: upErr.message };
    const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    const { error } = await supabase.from('profiles').update({ avatar_url: url, avatar_source: 'upload' }).eq('id', userId);
    if (error) return { success: false, error: error.message };
    return { success: true, url };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed.' };
  }
}

/** Switches back to the Google photo (refreshed at every sign-in). */
export async function switchToGoogleAvatar(userId: string): Promise<{ success: boolean; url?: string | null; error?: string }> {
  if (isDemoMode()) return { success: false, error: 'Not available with sample data.' };
  const { error } = await supabase.from('profiles').update({ avatar_source: 'google' }).eq('id', userId);
  if (error) return { success: false, error: error.message };
  const { data, error: rpcErr } = await supabase.rpc('sync_my_google_avatar');
  if (rpcErr) return { success: false, error: rpcErr.message };
  return { success: true, url: (data as string | null) ?? null };
}

/** Refreshes the Google photo at sign-in (does nothing for an uploaded photo). */
export async function syncGoogleAvatar(): Promise<string | null> {
  if (isDemoMode()) return null;
  const { data, error } = await supabase.rpc('sync_my_google_avatar');
  if (error) return null;
  return (data as string | null) ?? null;
}
