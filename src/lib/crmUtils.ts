import type { CrmActivityKind, CrmContact, CrmSource, CrmStage } from '../types/database';

/** The pipeline in order (SPEC: New, Invited to intro talk, Attended, Interested, Registered, Completed). */
export const PIPELINE: Exclude<CrmStage, 'lost'>[] = ['new', 'invited', 'attended', 'interested', 'registered', 'completed'];
export const ALL_STAGES: CrmStage[] = [...PIPELINE, 'lost'];

export const STAGE_LABEL: Record<CrmStage, string> = {
  new: 'New',
  invited: 'Invited',
  attended: 'Attended',
  interested: 'Interested',
  registered: 'Registered',
  completed: 'Completed',
  lost: 'Lost',
};

export const STAGE_HINT: Record<CrmStage, string> = {
  new: 'Not contacted yet',
  invited: 'Invited to an intro talk',
  attended: 'Came to an intro talk',
  interested: 'Wants to do a programme',
  registered: 'Registered for a programme',
  completed: 'Finished the programme',
  lost: 'Not interested now, or asked not to be contacted',
};

export const STAGE_CLASS: Record<CrmStage, string> = {
  new: 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300',
  invited: 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
  attended: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  interested: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  registered: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  completed: 'bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300',
  lost: 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400',
};

export const SOURCE_LABEL: Record<CrmSource, string> = {
  friend: 'Friend or family',
  walk_in: 'Walk-in or fair',
  social: 'Social media',
  event: 'At an event',
  website: 'Website',
  other: 'Other',
};

export const ACTIVITY_LABEL: Record<CrmActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Met in person',
  stage: 'Update',
};

export function stageRank(stage: CrmStage): number {
  return stage === 'lost' ? -1 : PIPELINE.indexOf(stage);
}

/** Number of leads in each stage. */
export function pipelineCounts(contacts: Pick<CrmContact, 'stage'>[]): Record<CrmStage, number> {
  const counts = Object.fromEntries(ALL_STAGES.map((s) => [s, 0])) as Record<CrmStage, number>;
  for (const c of contacts) counts[c.stage] += 1;
  return counts;
}

/** Leads with a follow-up due today or earlier (not lost or finished). */
export function isFollowUpDue(c: Pick<CrmContact, 'next_action_on' | 'stage'>, today: string): boolean {
  return Boolean(c.next_action_on) && c.next_action_on! <= today && c.stage !== 'lost' && c.stage !== 'completed';
}

export type ContactFilter = CrmStage | 'all' | 'due';

export function filterContacts<T extends Pick<CrmContact, 'full_name' | 'email' | 'phone' | 'stage' | 'next_action_on'>>(
  contacts: T[],
  filter: ContactFilter,
  search: string,
  today: string
): T[] {
  const q = search.trim().toLowerCase();
  return contacts
    .filter((c) => (filter === 'all' ? true : filter === 'due' ? isFollowUpDue(c, today) : c.stage === filter))
    .filter((c) => !q || [c.full_name, c.email, c.phone].some((v) => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => {
      const dueA = isFollowUpDue(a, today) ? 0 : 1;
      const dueB = isFollowUpDue(b, today) ? 0 : 1;
      if (dueA !== dueB) return dueA - dueB;
      return a.full_name.localeCompare(b.full_name);
    });
}

export interface ContactInput {
  full_name: string;
  email: string;
  phone: string;
  source: CrmSource;
  interest_course_id: string | null;
  owner_id: string | null;
  consent: boolean;
  opted_out: boolean;
  next_action_on: string;
  notes: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactInput(input: ContactInput): string[] {
  const errors: string[] = [];
  if (!input.full_name.trim()) errors.push('Please enter a name.');
  if (input.email.trim() && !EMAIL_RE.test(input.email.trim())) errors.push('The email address does not look right.');
  if (input.phone.trim() && phoneDigits(input.phone).length < 7) errors.push('The phone number looks too short.');
  if (!input.email.trim() && !input.phone.trim()) errors.push('Please add a phone number or an email, so they can be invited.');
  return errors;
}

/** Digits of a phone number for WhatsApp links: "+971 50 123 4567" -> "971501234567". */
export function phoneDigits(phone: string | null | undefined): string {
  // Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits count as digits too
  const western = (phone || '').replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) & 0xf));
  const digits = western.replace(/\D/g, '');
  return digits.startsWith('00') ? digits.slice(2) : digits;
}

/** WhatsApp works only with the international format (country code first). */
export function looksInternational(phone: string | null | undefined): boolean {
  const p = (phone || '').trim();
  return p.startsWith('+') || p.startsWith('00');
}

/** One-tap WhatsApp link (with a phone number: to that person; without: choose a chat). */
export function whatsappUrl(phone: string | null | undefined, text: string): string {
  const digits = looksInternational(phone) ? phoneDigits(phone) : '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function telUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/** Invitation to an event (intro talk). The volunteer can edit it before sending. */
export function eventInviteMessage(p: {
  contactName: string;
  senderName: string;
  eventTitle: string;
  when: string;
  venue: string | null;
  onlineUrl: string | null;
}): string {
  const where = [p.venue, p.onlineUrl].filter(Boolean).join(' / ');
  return [
    `Hi ${firstName(p.contactName)},`,
    '',
    `I would love to invite you to "${p.eventTitle}" on ${p.when}${where ? ` at ${where}` : ''}.`,
    'It is free and takes about an hour. Would you like to come?',
    '',
    p.senderName ? firstName(p.senderName) : '',
  ]
    .join('\n')
    .trim();
}

/** Invitation to join a programme batch, with the batch's QR join link. */
export function programmeInviteMessage(p: {
  contactName: string;
  senderName: string;
  courseName: string;
  batchName: string;
  startDate: string;
  joinUrl: string;
  appName: string;
}): string {
  return [
    `Hi ${firstName(p.contactName)},`,
    '',
    `You are registered for the ${p.courseName} (${p.batchName}), starting ${p.startDate}.`,
    `Please open this link and sign in with Google. It adds you to the batch in the ${p.appName} app:`,
    p.joinUrl,
    '',
    p.senderName ? firstName(p.senderName) : '',
  ]
    .join('\n')
    .trim();
}

/** Message to share a batch QR link with a whole group (teacher or admin). */
export function batchShareMessage(p: { batchName: string; courseName: string; joinUrl: string; appName: string }): string {
  return `Join "${p.batchName}"${p.courseName ? ` (${p.courseName})` : ''} in the ${p.appName} app: open ${p.joinUrl} and sign in with Google. You are added to the batch automatically.`;
}
