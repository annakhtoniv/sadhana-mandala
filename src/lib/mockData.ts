import type { Course, Batch, Enrolment, Checkin, Profile } from '../types/database';

// Compute start date so today is exactly Day 23 of 40
const todayDate = new Date();
const startDateObj = new Date(todayDate);
startDateObj.setDate(todayDate.getDate() - 22);
const startDateFormat = startDateObj.toISOString().split('T')[0];

export const DEMO_ORG_ID = 'b05dc423-a7e1-439f-9c72-ec94aad01aa0';

export const DEMO_TEACHER_PROFILE: Profile = {
  id: 'b0000000-0000-0000-0000-000000000001',
  org_id: DEMO_ORG_ID,
  email: 'vinoth@sadhana.zyxenai.com',
  full_name: 'Vinoth Rajaasekaran',
  role: 'admin',
  consent_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEMO_COURSE_40: Course = {
  id: 'c1000000-0000-0000-0000-000000000001',
  org_id: DEMO_ORG_ID,
  name: '40-Day Sadhana Practice',
  description: 'A transformative daily meditation and awareness commitment for forty days.',
  duration_days: 40,
  created_at: new Date().toISOString(),
};

export const DEMO_COURSE_21: Course = {
  id: 'c1000000-0000-0000-0000-000000000002',
  org_id: DEMO_ORG_ID,
  name: '21-Day Mindfulness Starter',
  description: 'A gentle introduction to daily sitting, breath observation, and calm awareness.',
  duration_days: 21,
  created_at: new Date().toISOString(),
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
    const isRest = day === 7 || day === 14 || day === 21;
    checkins.push({
      id: `checkin-demo-${studentId}-${day}`,
      org_id: DEMO_ORG_ID,
      batch_id: batchId,
      student_id: studentId,
      day_number: day,
      status: isRest ? 'rest' : 'done',
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
      let status: 'done' | 'rest' | 'not_yet' = 'done';
      if (day === 7 || day === 14 || day === 21) {
        status = 'rest';
      } else if (idx === 10 && day === 12) {
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  });

  return allCheckins;
}
