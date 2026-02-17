/**
 * Unit tests for TrajectoireTimeline — classifyMilestones logic.
 *
 * Tests the pure classification function that splits milestones
 * into completed/current/next buckets for the timeline rendering.
 */

import { classifyMilestones } from '@/components/dashboard/TrajectoireTimeline';
import type { TimelineMilestone } from '@/components/dashboard/TrajectoireTimeline';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMilestone(
  overrides: Partial<TimelineMilestone> & { id: string }
): TimelineMilestone {
  return {
    title: `Milestone ${overrides.id}`,
    targetDate: '2026-06-01',
    completed: false,
    completedAt: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('classifyMilestones', () => {
  it('returns empty buckets for empty array', () => {
    const result = classifyMilestones([]);
    expect(result.completed).toEqual([]);
    expect(result.current).toBeNull();
    expect(result.next).toBeNull();
  });

  it('classifies a single incomplete milestone as current', () => {
    const milestones = [makeMilestone({ id: 'm1' })];
    const result = classifyMilestones(milestones);

    expect(result.completed).toEqual([]);
    expect(result.current).not.toBeNull();
    expect(result.current!.id).toBe('m1');
    expect(result.next).toBeNull();
  });

  it('classifies a single completed milestone as completed', () => {
    const milestones = [
      makeMilestone({ id: 'm1', completed: true, completedAt: '2026-05-01' }),
    ];
    const result = classifyMilestones(milestones);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].id).toBe('m1');
    expect(result.current).toBeNull();
    expect(result.next).toBeNull();
  });

  it('classifies mixed milestones into correct buckets', () => {
    const milestones = [
      makeMilestone({ id: 'm1', targetDate: '2026-03-01', completed: true, completedAt: '2026-03-10' }),
      makeMilestone({ id: 'm2', targetDate: '2026-04-01', completed: true, completedAt: '2026-04-05' }),
      makeMilestone({ id: 'm3', targetDate: '2026-05-01' }),
      makeMilestone({ id: 'm4', targetDate: '2026-06-01' }),
    ];
    const result = classifyMilestones(milestones);

    expect(result.completed).toHaveLength(2);
    expect(result.completed[0].id).toBe('m1');
    expect(result.completed[1].id).toBe('m2');
    expect(result.current!.id).toBe('m3');
    expect(result.next!.id).toBe('m4');
  });

  it('sorts milestones by targetDate regardless of input order', () => {
    const milestones = [
      makeMilestone({ id: 'm3', targetDate: '2026-06-01' }),
      makeMilestone({ id: 'm1', targetDate: '2026-03-01', completed: true, completedAt: '2026-03-10' }),
      makeMilestone({ id: 'm2', targetDate: '2026-04-15' }),
    ];
    const result = classifyMilestones(milestones);

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].id).toBe('m1');
    expect(result.current!.id).toBe('m2');
    expect(result.next!.id).toBe('m3');
  });

  it('handles all milestones completed', () => {
    const milestones = [
      makeMilestone({ id: 'm1', targetDate: '2026-03-01', completed: true, completedAt: '2026-03-10' }),
      makeMilestone({ id: 'm2', targetDate: '2026-04-01', completed: true, completedAt: '2026-04-05' }),
    ];
    const result = classifyMilestones(milestones);

    expect(result.completed).toHaveLength(2);
    expect(result.current).toBeNull();
    expect(result.next).toBeNull();
  });

  it('handles all milestones incomplete', () => {
    const milestones = [
      makeMilestone({ id: 'm1', targetDate: '2026-05-01' }),
      makeMilestone({ id: 'm2', targetDate: '2026-06-01' }),
      makeMilestone({ id: 'm3', targetDate: '2026-07-01' }),
    ];
    const result = classifyMilestones(milestones);

    expect(result.completed).toEqual([]);
    expect(result.current!.id).toBe('m1');
    expect(result.next!.id).toBe('m2');
    // Third milestone is neither current nor next (only first 2 remaining are exposed)
  });

  it('does not mutate the original array', () => {
    const milestones = [
      makeMilestone({ id: 'm2', targetDate: '2026-06-01' }),
      makeMilestone({ id: 'm1', targetDate: '2026-03-01' }),
    ];
    const original = [...milestones];
    classifyMilestones(milestones);

    expect(milestones[0].id).toBe(original[0].id);
    expect(milestones[1].id).toBe(original[1].id);
  });

  it('handles milestones with same targetDate', () => {
    const milestones = [
      makeMilestone({ id: 'm1', targetDate: '2026-05-01', completed: true, completedAt: '2026-05-01' }),
      makeMilestone({ id: 'm2', targetDate: '2026-05-01' }),
    ];
    const result = classifyMilestones(milestones);

    expect(result.completed).toHaveLength(1);
    expect(result.current!.id).toBe('m2');
    expect(result.next).toBeNull();
  });
});
