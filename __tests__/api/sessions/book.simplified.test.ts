import { bookSessionSchema } from '@/app/api/sessions/contracts';

const basePayload = {
  coachId: 'coach-1',
  studentId: 'student-1',
  subject: 'MATHEMATIQUES' as const,
  scheduledDate: '2099-12-15',
  startTime: '14:00',
  endTime: '15:00',
  duration: 60,
  type: 'INDIVIDUAL' as const,
  modality: 'ONLINE' as const,
  title: 'Cours de mathématiques',
  description: 'Test session',
  creditsToUse: 2,
};

describe('bookSessionSchema', () => {
  it('accepts a valid payload', () => {
    const result = bookSessionSchema.safeParse(basePayload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBe(60);
    }
  });

  it('rejects sessions scheduled in the past', () => {
    const result = bookSessionSchema.safeParse({
      ...basePayload,
      scheduledDate: '1999-01-01',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.scheduledDate?.[0]).toContain('Cannot book sessions in the past');
    }
  });

  it('rejects when end time precedes start time', () => {
    const result = bookSessionSchema.safeParse({
      ...basePayload,
      endTime: '13:30',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.endTime?.[0]).toBe('End time must be after start time');
    }
  });

  it('rejects when duration does not match time difference', () => {
    const result = bookSessionSchema.safeParse({
      ...basePayload,
      duration: 120,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.duration?.[0]).toBe('Duration must match the time difference between start and end time');
    }
  });

  it('rejects credit usage above allowed maximum', () => {
    const result = bookSessionSchema.safeParse({
      ...basePayload,
      creditsToUse: 25,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.creditsToUse?.[0]).toContain('Cannot use more than 10 credits per session');
    }
  });
});
