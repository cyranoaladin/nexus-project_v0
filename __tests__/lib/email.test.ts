const queueCommittedEmail = jest.fn();

jest.mock('@/lib/email/queue', () => ({
  queueCommittedEmail: (...args: unknown[]) => queueCommittedEmail(...args),
}));

import { sendCreditExpirationReminder, sendWelcomeParentEmail } from '@/lib/email';

describe('email', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    queueCommittedEmail.mockReset().mockResolvedValue({ id: 'email-intent-test' });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('persists the welcome parent email intent without direct SMTP delivery', async () => {
    (process.env as any).NODE_ENV = 'production';
    await sendWelcomeParentEmail('parent@test.com', 'Parent', 'Student', 'https://nexusreussite.academy/auth/activate?token=abc');
    expect(queueCommittedEmail).toHaveBeenCalledTimes(1);
    expect(queueCommittedEmail).toHaveBeenCalledWith(expect.objectContaining({
      aggregateType: 'LEGACY_EMAIL',
      aggregateKey: 'parent@test.com',
      to: 'parent@test.com',
    }));
  });

  it('propagates persistence errors in development', async () => {
    (process.env as any).NODE_ENV = 'development';
    queueCommittedEmail.mockRejectedValueOnce(new Error('outbox unavailable'));
    await expect(
      sendWelcomeParentEmail('parent@test.com', 'Parent', 'Student')
    ).rejects.toThrow('outbox unavailable');
  });

  it('propagates persistence errors in production', async () => {
    (process.env as any).NODE_ENV = 'production';
    queueCommittedEmail.mockRejectedValueOnce(new Error('outbox unavailable'));
    await expect(
      sendCreditExpirationReminder('parent@test.com', 'Parent', 'Student', 2, new Date())
    ).rejects.toThrow('outbox unavailable');
  });
});
