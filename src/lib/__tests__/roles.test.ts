import { describe, it, expect } from 'vitest';
import { allowedRoleViews, canUseCrm, defaultRoleView, isStaffRole, rolesOf, primaryRole, hasRole } from '../roles';

describe('allowedRoleViews', () => {
  it('lets a student see only the student view', () => {
    expect(allowedRoleViews('student')).toEqual(['student']);
  });

  it('lets a teacher preview the student view but not admin', () => {
    expect(allowedRoleViews('teacher')).toEqual(['student', 'teacher']);
  });

  it('lets an admin see every view', () => {
    expect(allowedRoleViews('admin')).toEqual(['student', 'teacher', 'admin']);
  });
});

describe('volunteer role', () => {
  it('uses the student home and the CRM, but not staff tools', () => {
    expect(allowedRoleViews('volunteer')).toEqual(['student']);
    expect(defaultRoleView('volunteer')).toBe('student');
    expect(canUseCrm('volunteer')).toBe(true);
    expect(isStaffRole('volunteer')).toBe(false);
  });

  it('keeps students out of the CRM', () => {
    expect(canUseCrm('student')).toBe(false);
    expect(canUseCrm(null)).toBe(false);
    expect(canUseCrm('teacher')).toBe(true);
    expect(defaultRoleView('admin')).toBe('admin');
  });
});

describe('several roles per person (Phase 13)', () => {
  it('reads the list, or the single role on older rows, in a fixed order', () => {
    expect(rolesOf({ role: 'teacher', roles: ['volunteer', 'student', 'teacher'] })).toEqual(['student', 'volunteer', 'teacher']);
    expect(rolesOf({ role: 'volunteer' })).toEqual(['volunteer']);
    expect(rolesOf({ role: 'admin', roles: [] })).toEqual(['admin']);
  });

  it('the main role is the highest one, as in the database', () => {
    expect(primaryRole(['student', 'volunteer'])).toBe('volunteer');
    expect(primaryRole(['volunteer', 'teacher'])).toBe('teacher');
    expect(primaryRole(['student', 'volunteer', 'teacher', 'admin'])).toBe('admin');
    expect(primaryRole([])).toBe('student');
  });
});

describe('hasRole', () => {
  it('looks at every role a person holds', () => {
    expect(hasRole({ role: 'admin', roles: ['volunteer', 'admin'] }, 'volunteer')).toBe(true);
    expect(hasRole({ role: 'teacher', roles: ['teacher'] }, 'admin')).toBe(false);
    expect(hasRole({ role: 'admin' }, 'admin')).toBe(true);
    expect(hasRole(null, 'student')).toBe(false);
  });
});
