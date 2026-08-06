import { maintainEmailOutbox } from '@/lib/email/outbox-worker';
import { assertEmailOutboxWorkerConfiguration } from '@/lib/email/outbox-scheduler';

describe('email outbox maintenance', () => {
  const database = {
    jobOutbox: {
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_OUTBOX_COMPLETED_RETENTION_DAYS = '30';
    process.env.EMAIL_OUTBOX_AMBIGUOUS_ALERT_AGE_MS = '900000';
  });

  test('deletes at most one bounded batch and returns aggregate alerts', async () => {
    database.jobOutbox.findMany.mockResolvedValue([{ id: 'job-1' }, { id: 'job-2' }]);
    database.jobOutbox.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
    database.jobOutbox.deleteMany.mockResolvedValue({ count: 2 });

    const result = await maintainEmailOutbox(
      { limit: 2, now: new Date('2026-08-04T20:00:00.000Z') },
      database as never,
    );

    expect(database.jobOutbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2 }));
    expect(database.jobOutbox.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['job-1', 'job-2'] }, status: 'COMPLETED' },
    });
    expect(result).toEqual({ deleted: 2, failedFinal: 3, oldAmbiguous: 4 });
  });

  test('does not issue a delete when no completed job is eligible', async () => {
    database.jobOutbox.findMany.mockResolvedValue([]);
    database.jobOutbox.count.mockResolvedValue(0);

    await expect(maintainEmailOutbox({}, database as never)).resolves.toEqual({
      deleted: 0,
      failedFinal: 0,
      oldAmbiguous: 0,
    });
    expect(database.jobOutbox.deleteMany).not.toHaveBeenCalled();
  });
});

describe('email worker production preflight', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      EMAIL_OUTBOX_ENCRYPTION_KEY: 'test-only-email-outbox-key-32-chars-minimum',
      SMTP_HOST: 'smtp.internal.test',
      SMTP_PORT: '2525',
      SMTP_FROM: 'qa@example.test',
      EMAIL_OUTBOX_POLL_INTERVAL_MS: '5000',
      EMAIL_OUTBOX_MAINTENANCE_INTERVAL_MS: '3600000',
    };
  });

  afterAll(() => { process.env = originalEnv; });

  test('accepts a complete configuration', () => {
    expect(() => assertEmailOutboxWorkerConfiguration()).not.toThrow();
  });

  test.each([
    ['EMAIL_OUTBOX_ENCRYPTION_KEY', 'EMAIL_OUTBOX_ENCRYPTION_KEY_INVALID'],
    ['SMTP_HOST', 'SMTP_HOST_REQUIRED'],
    ['SMTP_FROM', 'SMTP_FROM_REQUIRED'],
  ])('refuses a missing %s', (name, code) => {
    delete process.env[name];
    expect(() => assertEmailOutboxWorkerConfiguration()).toThrow(code);
  });
});
