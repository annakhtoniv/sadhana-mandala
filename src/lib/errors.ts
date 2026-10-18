/**
 * Plain-language messages for errors from Supabase, so people never see raw
 * database text such as "new row violates row-level security policy".
 */
import { translate, type MsgKey } from '../i18n';

type ErrorLike = { message?: string; code?: string } | Error | string | null | undefined;

const RULES: Array<[RegExp, MsgKey]> = [
  [/row-level security|permission denied|42501/i, 'error.permission'],
  [/violates foreign key constraint .*checkins_batch_id_fkey/i, 'error.batchHasCheckins'],
  [/violates foreign key constraint .*batches_course_id_fkey/i, 'error.programmeHasBatches'],
  [/violates foreign key constraint .*batches_teacher_id_fkey/i, 'error.stillTeaches'],
  [/duplicate key|23505/i, 'error.exists'],
  [/Failed to fetch|NetworkError|network request failed|Load failed/i, 'error.offline'],
  [/JWT expired|invalid JWT|refresh token/i, 'error.signedOut'],
  [/payload too large|exceeded the maximum allowed size|413/i, 'error.tooLarge'],
  [/mime type .* is not supported|invalid_mime_type/i, 'error.fileType'],
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

export function friendlyError(err: ErrorLike, fallback = translate('error.generic')): string {
  if (!err) return fallback;
  const message = typeof err === 'string' ? err : err.message || '';
  const text = typeof err === 'string' ? err : `${message} ${'code' in err && err.code ? err.code : ''}`;
  if (OWN_MESSAGES.some((m) => message.includes(m))) return message.trim();
  for (const [pattern, friendly] of RULES) {
    if (pattern.test(text)) return translate(friendly);
  }
  return fallback;
}
