import type { UserRole } from '../types/database';

const ROLE_RANK: Record<UserRole, number> = { student: 0, teacher: 1, admin: 2 };

/** Views a user may switch between: their own role and every role below it. */
export function allowedRoleViews(role: UserRole): UserRole[] {
  return (['student', 'teacher', 'admin'] as UserRole[]).filter((r) => ROLE_RANK[r] <= ROLE_RANK[role]);
}
