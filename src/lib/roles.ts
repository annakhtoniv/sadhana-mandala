import type { UserRole } from '../types/database';

const ROLE_RANK: Record<UserRole, number> = { student: 0, volunteer: 1, teacher: 2, admin: 3 };

/** Home screens that exist. A volunteer uses the student home plus the Leads screen. */
const VIEW_ROLES: UserRole[] = ['student', 'teacher', 'admin'];

/** Views a user may switch between: their own role and every role below it. */
export function allowedRoleViews(role: UserRole): UserRole[] {
  return VIEW_ROLES.filter((r) => ROLE_RANK[r] <= ROLE_RANK[role]);
}

/** The home screen a user starts on: their highest allowed view. */
export function defaultRoleView(role: UserRole): UserRole {
  const views = allowedRoleViews(role);
  return views[views.length - 1];
}

/** Volunteers, teachers and admins use the CRM (Leads). */
export function canUseCrm(role: UserRole | null | undefined): boolean {
  return role === 'volunteer' || role === 'teacher' || role === 'admin';
}

/** Admins and teachers see every lead and the reports; volunteers only their own leads. */
export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === 'teacher' || role === 'admin';
}

export const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Student',
  volunteer: 'Volunteer',
  teacher: 'Teacher',
  admin: 'Admin',
};

/** Phase 13: a person may hold several roles; this is the fixed display order. */
export const ALL_ROLES: UserRole[] = ['student', 'volunteer', 'teacher', 'admin'];

export const ROLE_HINT: Record<UserRole, string> = {
  student: 'Joins batches and checks in',
  volunteer: 'Own leads in the Leads screen',
  teacher: 'Runs batches and programmes',
  admin: 'Everything, including people',
};

/** The roles of a person; older rows only have the single role. */
export function rolesOf(p: { role: UserRole; roles?: UserRole[] | null }): UserRole[] {
  const list = p.roles && p.roles.length > 0 ? p.roles : [p.role];
  return ALL_ROLES.filter((r) => list.includes(r));
}

/** The highest role in a list; the database keeps profiles.role equal to this. */
export function primaryRole(roles: UserRole[]): UserRole {
  return [...ALL_ROLES].reverse().find((r) => roles.includes(r)) ?? 'student';
}

/** Whether a person holds a role (looks at the full list, not only the highest role). */
export function hasRole(p: { role: UserRole; roles?: UserRole[] | null } | null | undefined, role: UserRole): boolean {
  return Boolean(p) && rolesOf(p as { role: UserRole; roles?: UserRole[] | null }).includes(role);
}
