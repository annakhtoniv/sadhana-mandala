import { isoToZonedInput, zonedInputToIso } from './dateUtils';
import type { Course, Batch, Enrolment, Checkin, Profile, Lesson, LessonModule, FollowupStep, OrgEvent, EventRegistration, RegistrationStatus, CrmContact, CrmActivity, CrmStage, CrmSource, FunnelReport } from '../types/database';

// Compute start date so today is exactly Day 23 of 40
const todayDate = new Date();
const startDateObj = new Date(todayDate);
startDateObj.setDate(todayDate.getDate() - 22);
const startDateFormat = startDateObj.toISOString().split('T')[0];

export const DEMO_ORG_ID = 'b05dc423-a7e1-439f-9c72-ec94aad01aa0';

export const DEMO_TEACHER_PROFILE: Profile = {
  id: 'b0000000-0000-0000-0000-000000000001',
  org_id: DEMO_ORG_ID,
  email: 'annakhtoniv@gmail.com',
  full_name: 'Vinoth Rajaasekaran',
  role: 'admin',
  consent_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEMO_COURSE_40: Course = {
  id: 'c1000000-0000-0000-0000-000000000001',
  org_id: DEMO_ORG_ID,
  name: 'Happiness Program',
  code: 'HP',
  category: 'Core programme',
  description: 'Introductory programme with breathing, meditation and wisdom, followed by a 40-day daily practice.',
  programme_days: 3,
  has_practice_track: true,
  practice_name: '40-Day Sadhana',
  duration_days: 40,
  prerequisite_ids: [],
  is_active: true,
  sort_order: 10,
  created_at: new Date().toISOString(),
};

export const DEMO_COURSE_21: Course = {
  id: 'c1000000-0000-0000-0000-000000000002',
  org_id: DEMO_ORG_ID,
  name: '21-Day Mindfulness Starter',
  code: 'MS21',
  category: 'Meditation',
  description: 'A gentle introduction to daily sitting, breath observation, and calm awareness.',
  has_practice_track: true,
  practice_name: '21-Day Practice',
  duration_days: 21,
  prerequisite_ids: [],
  is_active: true,
  sort_order: 30,
  created_at: new Date().toISOString(),
};

export const DEMO_COURSE_SILENCE: Course = {
  id: 'c1000000-0000-0000-0000-000000000002',
  org_id: DEMO_ORG_ID,
  name: 'Art of Silence',
  code: 'AOS',
  category: 'Advanced programme',
  description: 'Residential silence programme that deepens the Happiness Program practices.',
  programme_days: null,
  has_practice_track: false,
  practice_name: null,
  duration_days: 40,
  prerequisite_ids: ['c1000000-0000-0000-0000-000000000001'],
  is_active: true,
  sort_order: 20,
  created_at: new Date().toISOString(),
};

export const DEMO_BATCH_SILENCE: Batch = {
  id: 'd1000000-0000-0000-0000-000000000005',
  org_id: DEMO_ORG_ID,
  course_id: DEMO_COURSE_SILENCE.id,
  teacher_id: DEMO_TEACHER_PROFILE.id,
  name: 'Art of Silence – September',
  start_date: new Date(Date.now() - 25 * 86400000).toISOString().split('T')[0],
  join_code: 'SILENCE09',
  created_at: new Date().toISOString(),
  course: DEMO_COURSE_SILENCE,
  teacher: DEMO_TEACHER_PROFILE,
};

export const DEMO_BATCH_DAY23: Batch = {
  id: 'd1000000-0000-0000-0000-000000000001',
  org_id: DEMO_ORG_ID,
  course_id: DEMO_COURSE_40.id,
  teacher_id: DEMO_TEACHER_PROFILE.id,
  name: 'Autumn Awakening Cohort',
  start_date: startDateFormat,
  join_code: 'AUTUMN23',
  created_at: new Date().toISOString(),
  course: DEMO_COURSE_40,
  teacher: DEMO_TEACHER_PROFILE,
};

export const DEMO_ALL_BATCHES: Batch[] = [
  DEMO_BATCH_DAY23,
  {
    id: 'd1000000-0000-0000-0000-000000000002',
    org_id: DEMO_ORG_ID,
    course_id: DEMO_COURSE_40.id,
    teacher_id: DEMO_TEACHER_PROFILE.id,
    name: 'Summer Solstice Sadhana',
    start_date: new Date(Date.now() - 39 * 86400000).toISOString().split('T')[0],
    join_code: 'SUMMER40',
    created_at: new Date().toISOString(),
    course: DEMO_COURSE_40,
    teacher: DEMO_TEACHER_PROFILE,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000003',
    org_id: DEMO_ORG_ID,
    course_id: DEMO_COURSE_40.id,
    teacher_id: DEMO_TEACHER_PROFILE.id,
    name: 'New Moon Mindfulness',
    start_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    join_code: 'MOON2',
    created_at: new Date().toISOString(),
    course: DEMO_COURSE_40,
    teacher: DEMO_TEACHER_PROFILE,
  },
  {
    id: 'd1000000-0000-0000-0000-000000000004',
    org_id: DEMO_ORG_ID,
    course_id: DEMO_COURSE_40.id,
    teacher_id: DEMO_TEACHER_PROFILE.id,
    name: 'October Sadhana Cohort',
    start_date: new Date().toISOString().split('T')[0],
    join_code: 'SADH40',
    created_at: new Date().toISOString(),
    course: DEMO_COURSE_40,
    teacher: DEMO_TEACHER_PROFILE,
  },
  DEMO_BATCH_SILENCE,
];

export const DEMO_ENROLMENT_VINOTH: Enrolment = {
  id: 'e1000000-0000-0000-0000-000000000001',
  org_id: DEMO_ORG_ID,
  batch_id: DEMO_BATCH_DAY23.id,
  student_id: DEMO_TEACHER_PROFILE.id,
  source: 'manual',
  joined_at: new Date().toISOString(),
  batch: DEMO_BATCH_DAY23,
  student: DEMO_TEACHER_PROFILE,
};

export const DEMO_ENROLMENT_SILENCE: Enrolment = {
  id: 'e1000000-0000-0000-0000-000000000002',
  org_id: DEMO_ORG_ID,
  batch_id: DEMO_BATCH_SILENCE.id,
  student_id: DEMO_TEACHER_PROFILE.id,
  source: 'code',
  joined_at: new Date(Date.now() - 26 * 86400000).toISOString(),
  batch: DEMO_BATCH_SILENCE,
  student: DEMO_TEACHER_PROFILE,
};

// Generates 22 days of completed/rest checkins -> active 22-day streak on Day 23
export function getDemoCheckinsForStudent(studentId: string, batchId = DEMO_BATCH_DAY23.id): Checkin[] {
  // Check localStorage first so changes made by user persist
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    const localKey = `sadhana_checkins_${studentId}_${batchId}`;
    try {
      const saved = localStorage.getItem(localKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
  }

  const checkins: Checkin[] = [];
  for (let day = 1; day <= 22; day++) {
    const skipped = day === 7 || day === 14;
    checkins.push({
      id: `checkin-demo-${studentId}-${day}`,
      org_id: DEMO_ORG_ID,
      batch_id: batchId,
      student_id: studentId,
      day_number: day,
      status: skipped ? 'not_yet' : 'done',
      morning: !skipped,
      evening: !skipped && day % 3 !== 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  return checkins;
}

// 30 Fictional students for Teacher Roster
const STUDENT_NAMES = [
  'Aarav Mehta', 'Maya Lin', 'Leo Dubois', 'Elena Rostova', 'Fatima Al-Mansoori',
  'David Kim', 'Aisha Bello', 'Carlos Mendoza', 'Zoe Jenkins', 'Vikram Rao',
  'Sarah Connor', 'Kenji Takahashi', 'Chloe Martin', 'Tariq Al-Hashimi', 'Sofia Rossi',
  'Lucas Silva', 'Amara Okafor', 'Liam O\'Connor', 'Meera Krishnan', 'Jonas Mueller',
  'Layla Haddad', 'Gabriel Santos', 'Nina Petrova', 'Ethan Wright', 'Kavita Sharma',
  'Oliver Hansen', 'Yasmin Noor', 'Alexander Petrov', 'Hannah Abbott', 'Daniel Vance'
];

export const DEMO_ROSTER_STUDENTS: Profile[] = STUDENT_NAMES.map((name, idx) => ({
  id: `a1000000-0000-0000-0000-${String(idx + 1).padStart(12, '0')}`,
  org_id: DEMO_ORG_ID,
  email: `student.${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
  full_name: name,
  role: 'student' as const,
  consent_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  updated_at: new Date().toISOString(),
}));

// Generates checkins for the entire roster (Students 26..30 are QUIET: silent for days 19..23)
export function getDemoBatchCheckins(): Checkin[] {
  const allCheckins: Checkin[] = [];

  // 1. Vinoth's check-ins
  allCheckins.push(...getDemoCheckinsForStudent(DEMO_TEACHER_PROFILE.id));

  // 2. 30 fictional students
  DEMO_ROSTER_STUDENTS.forEach((student, idx) => {
    const isQuiet = idx >= 25; // Last 5 students are quiet!
    const maxDay = isQuiet ? 18 : 23;

    for (let day = 1; day <= maxDay; day++) {
      let status: 'done' | 'not_yet' = 'done';
      if (idx === 10 && day === 12) {
        status = 'not_yet';
      } else if (idx === 15 && (day === 5 || day === 18)) {
        status = 'not_yet';
      }

      allCheckins.push({
        id: `checkin-roster-${student.id}-${day}`,
        org_id: DEMO_ORG_ID,
        batch_id: DEMO_BATCH_DAY23.id,
        student_id: student.id,
        day_number: day,
        status,
        morning: status === 'done',
        evening: status === 'done' && (day + idx) % 3 !== 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  });

  return allCheckins;
}

// Phase 6: sample learning modules for demo mode
const demoLesson = (id: string, title: string, body: string, minutes: number, sort: number): Lesson => ({
  id,
  org_id: DEMO_ORG_ID,
  title,
  body,
  scope: 'course',
  published: true,
  sort_order: sort,
  estimated_minutes: minutes,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const demoModule = (
  id: string,
  courseId: string,
  title: string,
  sort: number,
  rule: LessonModule['unlock_rule'],
  day: number | null,
  lessons: Lesson[]
): LessonModule => ({
  id,
  org_id: DEMO_ORG_ID,
  course_id: courseId,
  title,
  description: null,
  sort_order: sort,
  unlock_rule: rule,
  unlock_day: day,
  published: true,
  created_at: '2026-01-01T00:00:00Z',
  lessons: lessons.map((l) => ({ ...l, course_id: courseId, module_id: id })),
});

export const DEMO_MODULES: LessonModule[] = [
  demoModule('dm-hp-1', DEMO_COURSE_40.id, 'Before you begin', 10, 'always', null, [
    demoLesson('dl-1', 'Welcome to the programme', '## Welcome\n\nSample lesson.\n\n- What the programme covers\n- How the daily practice works', 5, 10),
    demoLesson('dl-2', 'How the daily check-in works', '1. Open the app each day\n2. Answer **Done**, **Not yet** or **Rest day**', 3, 20),
  ]),
  demoModule('dm-hp-2', DEMO_COURSE_40.id, 'Week 1 of your practice', 20, 'day', 1, [
    demoLesson('dl-3', 'Setting up a daily routine', 'Sample lesson.', 5, 10),
  ]),
  demoModule('dm-hp-3', DEMO_COURSE_40.id, 'Going deeper', 30, 'sequential', null, [
    demoLesson('dl-4', 'Reflection: what has changed?', 'Sample reflection.', 10, 10),
  ]),
  demoModule('dm-aos-1', DEMO_COURSE_SILENCE.id, 'Preparing for silence', 10, 'always', null, [
    demoLesson('dl-5', 'What to bring', 'Sample packing list.', 3, 10),
  ]),
];

// Phase 7: sample follow-up plan for demo mode
const demoStep = (id: string, kind: FollowupStep['kind'], title: string, day: number, description: string | null = null): FollowupStep => ({
  id,
  org_id: DEMO_ORG_ID,
  course_id: DEMO_COURSE_40.id,
  kind,
  title,
  description,
  offset_day: day,
  sort_order: day * 10,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
});

export const DEMO_FOLLOWUP_STEPS: FollowupStep[] = [
  demoStep('df-1', 'reminder', 'Your 40-day practice starts today', 1, 'Practise at the same time each day and check in here.'),
  demoStep('df-2', 'personal', 'Check-in call: how is the practice going?', 3),
  demoStep('df-3', 'session', 'Week 1 follow-up session', 8, 'Group practice and questions.'),
  demoStep('df-4', 'reminder', 'Halfway there!', 21, 'Twenty days of practice done. Keep going.'),
  demoStep('df-5', 'session', 'Monthly follow-up session', 25),
];

// Phase 8: sample events for demo mode (times relative to now)
// Sample organisation time zone (the seeded organisations use Asia/Dubai)
const inDays = (days: number, hour: number) => {
  const d = new Date(Date.now() + days * 86400000);
  const date = isoToZonedInput(d.toISOString(), 'Asia/Dubai').slice(0, 10);
  return zonedInputToIso(`${date}T${String(hour).padStart(2, '0')}:00`, 'Asia/Dubai') as string;
};

export const DEMO_EVENTS: OrgEvent[] = [
  {
    id: 'de-1', org_id: DEMO_ORG_ID, kind: 'intro_talk', title: 'Introduction to the Happiness Program',
    description: 'A free 60-minute talk about the programme, with a short guided breathing session.',
    starts_at: inDays(3, 19), ends_at: inDays(3, 20), venue: 'Community centre, room 2', online_url: null,
    capacity: 30, course_id: DEMO_COURSE_40.id, batch_id: null, host_id: DEMO_TEACHER_PROFILE.id, published: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'de-2', org_id: DEMO_ORG_ID, kind: 'satsang', title: 'Monthly online satsang',
    description: 'Music, meditation and wisdom.', starts_at: inDays(7, 18), ends_at: inDays(7, 20), venue: null,
    online_url: 'https://example.com/satsang', capacity: null, course_id: null, batch_id: null,
    host_id: DEMO_TEACHER_PROFILE.id, published: true, created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'de-3', org_id: DEMO_ORG_ID, kind: 'intro_talk', title: 'Introduction to the Happiness Program',
    description: null, starts_at: inDays(-5, 19), ends_at: inDays(-5, 20), venue: 'Community centre, room 2',
    online_url: null, capacity: 20, course_id: DEMO_COURSE_40.id, batch_id: null, host_id: DEMO_TEACHER_PROFILE.id,
    published: true, created_at: '2026-01-01T00:00:00Z',
  },
];

export const DEMO_EVENT_REGISTRATIONS: EventRegistration[] = [
  ['Guest Rania', 'guest.rania@example.com', 'registered'],
  ['Guest Omar', 'guest.omar@example.com', 'registered'],
  ['Guest Priyanka', null, 'registered'],
].map(([name, email, status], i) => ({
  id: `der-${i}`, org_id: DEMO_ORG_ID, event_id: 'de-1', profile_id: null, guest_name: name as string,
  guest_email: email as string | null, guest_phone: null, status: status as RegistrationStatus,
  checked_in_at: null, created_at: '2026-01-01T00:00:00Z', profile: null,
}));

// Phase 9: sample leads for the 1-click demo (owned by the demo admin)
const demoDay = (days: number) => isoToZonedInput(new Date(Date.now() + days * 86400000).toISOString(), 'Asia/Dubai').slice(0, 10);

export const DEMO_CONTACTS: CrmContact[] = (
  [
    ['Rania Aziz', 'guest.rania@example.com', '+971 50 000 0001', 'friend', 'invited', 1, 'Colleague. Asked about the breathing technique.'],
    ['Hiro Tanaka', 'past.guest1@example.com', '+971 50 000 0011', 'event', 'attended', 0, 'Came to the last intro talk.'],
    ['Nadia Karim', 'past.guest3@example.com', '+971 50 000 0013', 'event', 'interested', 2, 'Wants a weekend batch.'],
    ['Joel Mathew', null, '+971 50 000 0015', 'walk_in', 'new', 0, 'Met at the community fair.'],
    ['Daniel Vance', 'student30@example.com', null, 'website', 'registered', null, null],
    ['Mona Saleh', 'mona.saleh@example.com', null, 'social', 'lost', null, 'Asked not to be contacted again.'],
  ] as [string, string | null, string | null, CrmSource, CrmStage, number | null, string | null][]
).map(([full_name, email, phone, source, stage, next, notes], i) => ({
  id: `dc-${i + 1}`,
  org_id: DEMO_ORG_ID,
  full_name,
  email,
  phone,
  source,
  stage,
  furthest_stage: stage === 'lost' ? 'invited' : stage,
  interest_course_id: DEMO_COURSE_40.id,
  owner_id: DEMO_TEACHER_PROFILE.id,
  profile_id: null,
  consent_at: '2026-10-01T00:00:00Z',
  opted_out: stage === 'lost',
  next_action_on: next === null ? null : demoDay(next),
  notes,
  created_by: DEMO_TEACHER_PROFILE.id,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}));

export const DEMO_CRM_ACTIVITIES: CrmActivity[] = [
  { id: 'da-1', org_id: DEMO_ORG_ID, contact_id: 'dc-1', kind: 'whatsapp', body: 'Sent the intro talk details.', created_by: DEMO_TEACHER_PROFILE.id, created_at: '2026-10-09T10:00:00Z' },
  { id: 'da-2', org_id: DEMO_ORG_ID, contact_id: 'dc-2', kind: 'call', body: 'Enjoyed the talk. Will check his calendar.', created_by: DEMO_TEACHER_PROFILE.id, created_at: '2026-10-08T10:00:00Z' },
];

export const DEMO_FUNNEL: FunnelReport = {
  since: null,
  leads: { total: 11, invited: 9, attended: 4, interested: 3, registered: 2, completed: 1, lost: 1, signed_up: 2 },
  sources: [
    { source: 'friend', leads: 4, registered: 1 },
    { source: 'event', leads: 3, registered: 0 },
    { source: 'website', leads: 2, registered: 1 },
    { source: 'social', leads: 1, registered: 0 },
    { source: 'walk_in', leads: 1, registered: 0 },
  ],
  owners: [
    { owner_id: 'v1', name: 'Ravi Kumar', leads: 6, registered: 1 },
    { owner_id: 'v2', name: 'Sara Haddad', leads: 3, registered: 1 },
    { owner_id: null, name: 'Unassigned', leads: 2, registered: 0 },
  ],
  journey: [
    { course_id: DEMO_COURSE_40.id, course_name: 'Happiness Program', practice_days: 40, enrolled: 35, track_over: 15, completed: 9, next_programme: 10 },
  ],
};
