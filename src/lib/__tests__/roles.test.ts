import { describe, it, expect } from 'vitest';
import { allowedRoleViews } from '../roles';

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
