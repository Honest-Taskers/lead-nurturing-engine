import { describe, it, expect } from 'vitest';
import { getDueStatus, isDue, addDays, formatShortDate, type Lead } from './types';

const base: Lead = {
  id: 'l1',
  organization: 'Test Org',
  industry: 'Hospital System',
  personaName: 'Pat Tester',
  personaTitle: 'VP',
  assignedRep: 'Jaya',
} as Lead;

const today = new Date('2026-08-10T12:00:00');

describe('getDueStatus (report cadence)', () => {
  it('is "never" without a next due date', () => {
    expect(getDueStatus({ ...base, nextDueDate: undefined }, today)).toEqual({ kind: 'never' });
  });

  it('is "today" when due today', () => {
    expect(getDueStatus({ ...base, nextDueDate: '2026-08-10' }, today)).toEqual({ kind: 'today' });
  });

  it('is "overdue" with day count when the date has passed', () => {
    expect(getDueStatus({ ...base, nextDueDate: '2026-08-07' }, today)).toEqual({ kind: 'overdue', days: 3 });
  });

  it('is "soon" within a week', () => {
    expect(getDueStatus({ ...base, nextDueDate: '2026-08-15' }, today)).toEqual({ kind: 'soon', days: 5 });
  });

  it('is "scheduled" beyond a week', () => {
    expect(getDueStatus({ ...base, nextDueDate: '2026-09-01' }, today)).toEqual({ kind: 'scheduled', date: '2026-09-01' });
  });
});

describe('isDue', () => {
  it('treats never/today/overdue/soon as due, scheduled as not due', () => {
    expect(isDue({ ...base, nextDueDate: undefined }, today)).toBe(true);
    expect(isDue({ ...base, nextDueDate: '2026-08-10' }, today)).toBe(true);
    expect(isDue({ ...base, nextDueDate: '2026-09-01' }, today)).toBe(false);
  });
});

describe('date helpers', () => {
  it('addDays crosses month boundaries', () => {
    expect(addDays('2026-08-25', 14)).toBe('2026-09-08');
  });

  it('formatShortDate falls back to a dash', () => {
    expect(formatShortDate(undefined)).toBe('—');
  });
});
