import { describe, it, expect } from 'vitest';
import { friendlyError } from '../errors';

describe('friendlyError', () => {
  it('turns database refusals into plain words', () => {
    expect(friendlyError({ message: 'new row violates row-level security policy for table "checkins"', code: '42501' })).toBe(
      'You do not have permission to do that.'
    );
    expect(friendlyError(new Error('TypeError: Failed to fetch'))).toBe('No connection. Check your internet and try again.');
    expect(friendlyError({ message: 'update or delete on table "batches" violates foreign key constraint "checkins_batch_id_fkey"' })).toBe(
      'This batch already has check-ins, so it cannot be deleted.'
    );
  });

  it('keeps messages our own database functions write for people', () => {
    expect(friendlyError({ message: 'You still teach one or more batches. Ask an admin to give them to another teacher first.', code: 'P0001' })).toBe(
      'You still teach one or more batches. Ask an admin to give them to another teacher first.'
    );
  });

  it('falls back to a general message', () => {
    expect(friendlyError(null)).toBe('Something went wrong. Please try again.');
    expect(friendlyError({ message: 'weird' }, 'Could not save.')).toBe('Could not save.');
  });
});
