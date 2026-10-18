/**
 * Plain-language messages for errors from Supabase, so people never see raw
 * database text such as "new row violates row-level security policy".
 */
type ErrorLike = { message?: string; code?: string } | Error | string | null | undefined;

const RULES: Array<[RegExp, string]> = [
  [/row-level security|permission denied|42501/i, 'You do not have permission to do that.'],
  [/violates foreign key constraint .*checkins_batch_id_fkey/i, 'This batch already has check-ins, so it cannot be deleted.'],
  [/violates foreign key constraint .*batches_course_id_fkey/i, 'This programme has batches, so it cannot be deleted. Archive it instead.'],
  [/violates foreign key constraint .*batches_teacher_id_fkey/i, 'This person still teaches a batch. Give the batch to another teacher first.'],
  [/duplicate key|23505/i, 'That already exists.'],
  [/Failed to fetch|NetworkError|network request failed|Load failed/i, 'No connection. Check your internet and try again.'],
  [/JWT expired|invalid JWT|refresh token/i, 'Your sign-in has expired. Please sign in again.'],
  [/payload too large|exceeded the maximum allowed size|413/i, 'The file is too large.'],
  [/mime type .* is not supported|invalid_mime_type/i, 'This type of file cannot be uploaded.'],
];

/** Messages our own database functions raise on purpose are already written for people. */
const OWN_MESSAGES = [
  'You still teach',
  'The organisation needs at least one admin',
  'You cannot remove your own admin role',
  'Only an admin of this organisation can change roles',
  'Unknown time zone',
  'Too many wrong codes',
];

export function friendlyError(err: ErrorLike, fallback = 'Something went wrong. Please try again.'): string {
  if (!err) return fallback;
  const message = typeof err === 'string' ? err : err.message || '';
  const text = typeof err === 'string' ? err : `${message} ${'code' in err && err.code ? err.code : ''}`;
  if (OWN_MESSAGES.some((m) => message.includes(m))) return message.trim();
  for (const [pattern, friendly] of RULES) {
    if (pattern.test(text)) return friendly;
  }
  return fallback;
}
