/**
 * Database tables as they exist (columns and types), generated from the schema
 * after Phase 18. The app's own types in database.ts are checked against these
 * at build time (schemaDrift.ts), so a renamed or removed column breaks the build.
 * Regenerate after a migration, e.g. with the Supabase CLI:
 *   npx supabase gen types typescript --project-id pshapxojprvgmwhdivim
 * (or ask Claude to regenerate it from a local copy of the database).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface DbTables {
  batch_invites: {
    batch_id: string;
    claimed_by: string | null;
    created_at: string;
    email: string;
    id: string;
    org_id: string;
  };
  batches: {
    course_id: string;
    created_at: string;
    end_date: string;
    id: string;
    join_code: string;
    name: string;
    org_id: string;
    start_date: string;
    teacher_id: string;
  };
  checkins: {
    batch_id: string;
    created_at: string;
    day_number: number;
    evening: boolean;
    evening_at: string | null;
    id: string;
    late: boolean;
    morning: boolean;
    morning_at: string | null;
    org_id: string;
    status: string;
    student_id: string;
    updated_at: string;
  };
  client_errors: {
    app_version: string | null;
    created_at: string;
    detail: string | null;
    id: string;
    message: string;
    org_id: string | null;
    page: string | null;
    user_id: string | null;
  };
  consent_events: {
    consented_at: string;
    id: string;
    notice_version: string;
    org_id: string;
    profile_id: string;
  };
  courses: {
    category: string;
    code: string | null;
    created_at: string;
    created_by: string | null;
    description: string | null;
    duration_days: number;
    has_practice_track: boolean;
    id: string;
    is_active: boolean;
    name: string;
    org_id: string;
    practice_name: string | null;
    prerequisite_ids: string[];
    programme_days: number | null;
    sort_order: number;
    updated_at: string;
  };
  crm_activities: {
    body: string;
    contact_id: string;
    created_at: string;
    created_by: string | null;
    id: string;
    kind: string;
    org_id: string;
  };
  crm_contacts: {
    consent_at: string | null;
    created_at: string;
    created_by: string | null;
    email: string | null;
    full_name: string;
    furthest_stage: string;
    id: string;
    interest_course_id: string | null;
    next_action_on: string | null;
    notes: string | null;
    opted_out: boolean;
    org_id: string;
    owner_id: string | null;
    phone: string | null;
    profile_id: string | null;
    source: string;
    stage: string;
    updated_at: string;
  };
  enrolments: {
    batch_id: string;
    id: string;
    joined_at: string;
    org_id: string;
    source: string;
    student_id: string;
  };
  event_registrations: {
    added_by: string | null;
    checked_in_at: string | null;
    contact_id: string | null;
    created_at: string;
    event_id: string;
    guest_email: string | null;
    guest_name: string | null;
    guest_phone: string | null;
    id: string;
    org_id: string;
    profile_id: string | null;
    status: string;
    updated_at: string;
  };
  events: {
    batch_id: string | null;
    capacity: number | null;
    checkin_code: string;
    course_id: string | null;
    created_at: string;
    created_by: string | null;
    description: string | null;
    ends_at: string | null;
    host_id: string | null;
    id: string;
    kind: string;
    online_url: string | null;
    org_id: string;
    published: boolean;
    starts_at: string;
    title: string;
    updated_at: string;
    venue: string | null;
  };
  followup_records: {
    batch_id: string;
    created_at: string;
    id: string;
    location: string | null;
    notes: string | null;
    org_id: string;
    scheduled_for: string | null;
    status: string;
    step_id: string;
    student_id: string | null;
    updated_at: string;
    updated_by: string | null;
  };
  followup_steps: {
    course_id: string;
    created_at: string;
    created_by: string | null;
    description: string | null;
    id: string;
    is_active: boolean;
    kind: string;
    offset_day: number;
    org_id: string;
    sort_order: number;
    title: string;
    updated_at: string;
  };
  join_attempts: {
    attempted_at: string;
    user_id: string;
  };
  lesson_modules: {
    course_id: string;
    created_at: string;
    created_by: string | null;
    description: string | null;
    id: string;
    org_id: string;
    published: boolean;
    sort_order: number;
    title: string;
    unlock_day: number | null;
    unlock_rule: string;
    updated_at: string;
  };
  lesson_progress: {
    completed_at: string;
    id: string;
    lesson_id: string;
    org_id: string;
    student_id: string;
  };
  lessons: {
    author_id: string | null;
    batch_id: string | null;
    body: string;
    course_id: string | null;
    created_at: string;
    day_number: number | null;
    estimated_minutes: number | null;
    id: string;
    module_id: string | null;
    org_id: string;
    published: boolean;
    scope: string;
    sort_order: number;
    title: string;
    updated_at: string;
    video_url: string | null;
  };
  organisations: {
    accent_colour: string;
    app_name: string;
    checkin_question: string;
    created_at: string;
    footer_text: string;
    id: string;
    logo_url: string | null;
    name: string;
    primary_colour: string;
    reminder_evening_text: string;
    reminder_evening_time: string;
    reminder_morning_text: string;
    reminder_morning_time: string;
    reminders_enabled: boolean;
    show_powered_by: boolean;
    slug: string;
    support_email: string;
    timezone: string;
    updated_at: string;
  };
  profiles: {
    avatar_source: string | null;
    avatar_url: string | null;
    consent_at: string | null;
    created_at: string;
    email: string;
    full_name: string | null;
    id: string;
    org_id: string;
    role: string;
    roles: string[];
    updated_at: string;
  };
  programme_materials: {
    course_id: string;
    created_at: string;
    created_by: string | null;
    description: string | null;
    id: string;
    kind: string;
    mime_type: string | null;
    org_id: string;
    published: boolean;
    size_bytes: number | null;
    sort_order: number;
    storage_path: string | null;
    title: string;
    updated_at: string;
    url: string | null;
  };
  push_subscriptions: {
    auth: string;
    created_at: string;
    endpoint: string;
    id: string;
    org_id: string;
    p256dh: string;
    updated_at: string;
    user_id: string;
  };
  reminder_sends: {
    local_date: string;
    org_id: string;
    phones: number | null;
    sent_at: string;
    slot: string;
  };
  role_grants: {
    created_at: string;
    email: string;
    id: string;
    org_id: string;
    role: string;
    roles: string[];
  };
}

export type DbRow<T extends keyof DbTables> = DbTables[T];
