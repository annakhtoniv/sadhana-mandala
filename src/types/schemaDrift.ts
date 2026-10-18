/**
 * Build-time check: every field of the app's own types (database.ts) must be a
 * real column of its table (supabase.generated.ts). If a column is renamed or
 * removed, `tsc` fails here and names the field. Joined objects (a batch's
 * course, an enrolment's student...) are listed as exceptions.
 * Nothing in this file runs in the browser.
 */
import type { DbTables } from './supabase.generated';
import type {
  Batch,
  BatchInvite,
  Checkin,
  Course,
  CrmActivity,
  CrmContact,
  Enrolment,
  EventRegistration,
  FollowupRecord,
  FollowupStep,
  Lesson,
  LessonModule,
  LessonProgress,
  Organisation,
  OrgEvent,
  Profile,
  ProgrammeMaterial,
  RoleGrant,
} from './database';

/** Field names of T that are not columns of the table (never = all fine). */
type NotColumns<T, Table extends keyof DbTables, Joined extends string = never> = Exclude<keyof T, keyof DbTables[Table] | Joined>;
/** Compiles only when there is nothing left over. */
type Ok<T extends never> = T;

export type SchemaDriftChecks = [
  Ok<NotColumns<Organisation, 'organisations'>>,
  Ok<NotColumns<Profile, 'profiles'>>,
  Ok<NotColumns<RoleGrant, 'role_grants'>>,
  Ok<NotColumns<Course, 'courses'>>,
  Ok<NotColumns<Batch, 'batches', 'course' | 'teacher'>>,
  Ok<NotColumns<BatchInvite, 'batch_invites'>>,
  Ok<NotColumns<Enrolment, 'enrolments', 'batch' | 'student'>>,
  Ok<NotColumns<Checkin, 'checkins'>>,
  Ok<NotColumns<Lesson, 'lessons'>>,
  Ok<NotColumns<LessonModule, 'lesson_modules', 'lessons'>>,
  Ok<NotColumns<LessonProgress, 'lesson_progress'>>,
  Ok<NotColumns<FollowupStep, 'followup_steps'>>,
  Ok<NotColumns<FollowupRecord, 'followup_records'>>,
  Ok<NotColumns<OrgEvent, 'events'>>,
  Ok<NotColumns<EventRegistration, 'event_registrations', 'profile'>>,
  Ok<NotColumns<CrmContact, 'crm_contacts'>>,
  Ok<NotColumns<CrmActivity, 'crm_activities'>>,
  Ok<NotColumns<ProgrammeMaterial, 'programme_materials'>>,
];
