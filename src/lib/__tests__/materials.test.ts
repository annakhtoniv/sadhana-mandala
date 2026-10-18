import { describe, it, expect, vi } from 'vitest';
vi.mock('../supabase', () => ({ supabase: {}, isDemoMode: () => false }));
import { formatBytes, kindForMime, safeFileName, titleFromFileName } from '../materialsService';

describe('study materials helpers', () => {
  it('recognises the kind of a file', () => {
    expect(kindForMime('application/pdf')).toBe('pdf');
    expect(kindForMime('', 'Notes.PDF')).toBe('pdf');
    expect(kindForMime('audio/mpeg')).toBe('audio');
    expect(kindForMime('video/mp4')).toBe('video');
    expect(kindForMime('image/png')).toBe('image');
    expect(kindForMime('application/msword')).toBe('file');
  });

  it('makes safe storage names and readable titles', () => {
    expect(safeFileName('My Notes (v2).PDF')).toBe('my-notes-v2.pdf');
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(titleFromFileName('guided_meditation-part-1.mp3')).toBe('guided meditation part 1');
  });

  it('formats sizes', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(null)).toBe('');
  });
});
