export type UserRole = 'student' | 'volunteer' | 'teacher' | 'admin';

export interface Organisation {
  id: string;
  name: string;
  slug: string;
  app_name: string;
  logo_url: string | null;
  primary_colour: string;
  accent_colour: string;
  support_email: string | null;
  checkin_question: string;
  footer_text: string | null;
  timezone: string;
  show_powered_by: boolean;
  created_at: string;
  /** Daily practice reminders (Phase 18); times are "HH:MM:SS" in the organisation's time zone */
  reminders_enabled?: boolean;
  reminder_morning_time?: string;
  reminder_morning_text?: string;
  reminder_evening_time?: string;
  reminder_evening_text?: string;
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  /** Phase 13: every role the person holds; role is the highest of them */
  roles?: UserRole[];
  consent_at: string | null;
  /** Phase 12: profile picture (Google photo or an uploaded one) */
  avatar_url?: string | null;
  avatar_source?: 'google' | 'upload' | null;
  created_at: string;
  updated_at: string;
}

export interface RoleGrant {
  id: string;
  org_id: string;
  email: string;
  role: UserRole;
  /** Phase 13: every role waiting for this email */
  roles?: UserRole[];
  created_at: string;
}

/**
 * A programme in the catalogue (stored in the `courses` table).
 * The Phase 5 fields are optional so older rows and sample data still type-check.
 */
export interface Course {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  /** Length of the daily practice track in days (only used when has_practice_track) */
  duration_days: number;
  created_at: string;
  code?: string | null;
  category?: string;
  /** Length of the programme itself in days, if known */
  programme_days?: number | null;
  has_practice_track?: boolean;
  practice_name?: string | null;
  prerequisite_ids?: string[];
  is_active?: boolean;
  sort_order?: number;
  created_by?: string | null;
  updated_at?: string;
}

export interface Batch {
  id: string;
  org_id: string;
  course_id: string;
  teacher_id: string;
  name: string;
  start_date: string;
  /** Last day of the batch (Phase 20); defaults from the programme's length */
  end_date: string;
  join_code: string;
  created_at: string;
  // Joined relation fields for convenience
  course?: Course;
  teacher?: Profile;
}

export interface BatchInvite {
  id: string;
  org_id: string;
  batch_id: string;
  email: string;
  claimed_by: string | null;
  created_at: string;
}

export type EnrolmentSource = 'invite' | 'code' | 'manual';

export interface Enrolment {
  id: string;
  org_id: string;
  batch_id: string;
  student_id: string;
  source: EnrolmentSource;
  joined_at: string;
  // Joined relation fields
  batch?: Batch;
  student?: Profile;
}

/** Kept in step by the database: 'done' when morning or evening is ticked. 'rest' only on old rows. */
export type CheckinStatus = 'done' | 'not_yet' | 'rest';

export interface Checkin {
  id: string;
  org_id: string;
  batch_id: string;
  student_id: string;
  day_number: number;
  status: CheckinStatus;
  /** Phase 11: Morning and Evening ticks */
  morning?: boolean;
  evening?: boolean;
  morning_at?: string | null;
  evening_at?: string | null;
  /** Written after its day */
  late?: boolean;
  created_at: string;
  updated_at: string;
}

export type LessonScope = 'general' | 'course' | 'batch';

export interface Lesson {
  id: string;
  org_id: string;
  title: string;
  body: string;
  video_url?: string | null;
  scope: LessonScope;
  course_id?: string | null;
  batch_id?: string | null;
  day_number?: number | null;
  published: boolean;
  author_id?: string | null;
  created_at: string;
  updated_at: string;
  /** Phase 6: the learning module this lesson belongs to (scope 'course') */
  module_id?: string | null;
  sort_order?: number;
  estimated_minutes?: number | null;
}

export type ModuleUnlockRule = 'always' | 'day' | 'sequential';

/** Phase 6: a learning module of a programme */
export interface LessonModule {
  id: string;
  org_id: string;
  course_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  unlock_rule: ModuleUnlockRule;
  unlock_day: number | null;
  published: boolean;
  created_at: string;
  updated_at?: string;
  /** Lessons of the module, in display order (filled in by the service) */
  lessons?: Lesson[];
}

/** Phase 6: one completed lesson of a student */
export interface LessonProgress {
  id: string;
  org_id: string;
  student_id: string;
  lesson_id: string;
  completed_at: string;
}

export type FollowupKind = 'session' | 'personal' | 'reminder';

/** Phase 7: one step of a programme's follow-up plan */
export interface FollowupStep {
  id: string;
  org_id: string;
  course_id: string;
  kind: FollowupKind;
  title: string;
  description: string | null;
  /** Day of the batch the step falls due (Day 1 = start date) */
  offset_day: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export type FollowupRecordStatus = 'scheduled' | 'done' | 'skipped';

/** Phase 7: a session scheduled/held in a batch (student_id null) or a personal follow-up */
export interface FollowupRecord {
  id: string;
  org_id: string;
  batch_id: string;
  step_id: string;
  student_id: string | null;
  status: FollowupRecordStatus;
  scheduled_for: string | null;
  location: string | null;
  notes: string | null;
  updated_at: string;
}

/** Phase 7: what a student may see of a follow-up session (my_batch_sessions) */
export interface BatchSession {
  step_id: string;
  title: string;
  description: string | null;
  offset_day: number;
  status: FollowupRecordStatus | null;
  scheduled_for: string | null;
  location: string | null;
}

export type EventKind = 'intro_talk' | 'programme' | 'satsang' | 'followup' | 'other';

/** Phase 8: an event of the organisation (the secret check-in code is never selected) */
export interface OrgEvent {
  id: string;
  org_id: string;
  kind: EventKind;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  online_url: string | null;
  capacity: number | null;
  course_id: string | null;
  batch_id: string | null;
  host_id: string | null;
  published: boolean;
  created_at: string;
  updated_at?: string;
}

export type RegistrationStatus = 'registered' | 'attended' | 'no_show' | 'cancelled';

/** Phase 8: a member or a guest registered for an event */
export interface EventRegistration {
  id: string;
  org_id: string;
  event_id: string;
  profile_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  status: RegistrationStatus;
  checked_in_at: string | null;
  created_at: string;
  /** Phase 9: the CRM lead this registration was made for */
  contact_id?: string | null;
  profile?: Pick<Profile, 'id' | 'full_name' | 'email'> | null;
}

export type CrmStage = 'new' | 'invited' | 'attended' | 'interested' | 'registered' | 'completed' | 'lost';
export type CrmSource = 'friend' | 'walk_in' | 'social' | 'event' | 'website' | 'other';
export type CrmActivityKind = 'note' | 'call' | 'whatsapp' | 'email' | 'meeting' | 'stage';

/** Phase 9: a lead (a person who may not have an account yet) */
export interface CrmContact {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: CrmSource;
  stage: CrmStage;
  furthest_stage: Exclude<CrmStage, 'lost'>;
  interest_course_id: string | null;
  owner_id: string | null;
  profile_id: string | null;
  /** When the person agreed to be contacted (PDPL) */
  consent_at: string | null;
  opted_out: boolean;
  next_action_on: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Phase 9: a note, call, message or stage change on a lead */
export interface CrmActivity {
  id: string;
  org_id: string;
  contact_id: string;
  kind: CrmActivityKind;
  body: string;
  created_by: string | null;
  created_at: string;
}

/** Phase 9: someone who can own leads */
export interface CrmOwner {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
}

/** Phase 10: funnel report (crm_funnel_report) */
export interface FunnelReport {
  since: string | null;
  leads: {
    total: number;
    invited: number;
    attended: number;
    interested: number;
    registered: number;
    completed: number;
    lost: number;
    signed_up: number;
  };
  sources: { source: CrmSource; leads: number; registered: number }[];
  owners: { owner_id: string | null; name: string; leads: number; registered: number }[];
  journey: {
    course_id: string;
    course_name: string;
    practice_days: number;
    enrolled: number;
    track_over: number;
    completed: number;
    next_programme: number;
  }[];
}

/** Batch QR: what the sign-in page shows before sign-in (batch_join_preview) */
export interface BatchJoinPreview {
  batch_name: string;
  course_name: string;
  start_date: string;
  org_name: string;
  org_slug: string;
}

export type MaterialKind = 'pdf' | 'audio' | 'video' | 'image' | 'file' | 'link';

/** Phase 12: a study material of a programme, shared by all its batches */
export interface ProgrammeMaterial {
  id: string;
  org_id: string;
  course_id: string;
  title: string;
  description: string | null;
  kind: MaterialKind;
  storage_path: string | null;
  url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sort_order: number;
  published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
}
