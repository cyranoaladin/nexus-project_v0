/**
 * Unit tests for Trajectory Engine — Pure logic tests (parseMilestones, enrichment).
 * DB-dependent functions (create, get, complete) are tested via integration tests.
 */

import { parseMilestones } from '@/lib/trajectory';

describe('parseMilestones', () => {
  it('returns empty array for null input', () => {
    expect(parseMilestones(null)).toEqual([]);
  });

  it('returns empty array for undefined input', () => {
    expect(parseMilestones(undefined)).toEqual([]);
  });

  it('returns empty array for non-array input', () => {
    expect(parseMilestones('not an array')).toEqual([]);
    expect(parseMilestones(42)).toEqual([]);
    expect(parseMilestones({})).toEqual([]);
  });

  it('returns empty array for empty array', () => {
    expect(parseMilestones([])).toEqual([]);
  });

  it('parses valid milestones correctly', () => {
    const raw = [
      {
        id: 'm1',
        title: 'Premier jalon',
        targetDate: '2026-04-01',
        completed: false,
        completedAt: null,
      },
      {
        id: 'm2',
        title: 'Deuxième jalon',
        targetDate: '2026-06-01',
        completed: true,
        completedAt: '2026-05-15T10:00:00.000Z',
      },
    ];

    const result = parseMilestones(raw);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'm1',
      title: 'Premier jalon',
      targetDate: '2026-04-01',
      completed: false,
      completedAt: null,
    });
    expect(result[1]).toEqual({
      id: 'm2',
      title: 'Deuxième jalon',
      targetDate: '2026-06-01',
      completed: true,
      completedAt: '2026-05-15T10:00:00.000Z',
    });
  });

  it('handles missing fields with defaults', () => {
    const raw = [{ id: 'x' }, {}];
    const result = parseMilestones(raw);

    expect(result[0]).toEqual({
      id: 'x',
      title: '',
      targetDate: '',
      completed: false,
      completedAt: null,
    });

    expect(result[1]).toEqual({
      id: '',
      title: '',
      targetDate: '',
      completed: false,
      completedAt: null,
    });
  });

  it('coerces types correctly', () => {
    const raw = [
      {
        id: 123,
        title: 456,
        targetDate: true,
        completed: 1,
        completedAt: 0,
      },
    ];
    const result = parseMilestones(raw);

    expect(result[0].id).toBe('123');
    expect(result[0].title).toBe('456');
    expect(result[0].completed).toBe(true);
    // completedAt: 0 is falsy → parseMilestones returns null
    expect(result[0].completedAt).toBeNull();
  });
});
