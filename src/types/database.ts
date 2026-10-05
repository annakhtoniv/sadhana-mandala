export type UserRole = 'student' | 'teacher' | 'admin';

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
}

export interface Profile {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  consent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoleGrant {
  id: string;
  org_id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Course {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  duration_days: number;
  created_at: string;
}

export interface Batch {
  id: string;
  org_id: string;
  course_id: string;
  teacher_id: string;
  name: string;
  start_date: string;
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

export type CheckinStatus = 'done' | 'not_yet' | 'rest';

export interface Checkin {
  id: string;
  org_id: string;
  batch_id: string;
  student_id: string;
  day_number: number;
  status: CheckinStatus;
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
}
