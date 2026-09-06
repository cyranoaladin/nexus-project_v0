const mockQueueCommittedEmail = jest.fn();
const mockVerifySmtp = jest.fn();
jest.mock('@/lib/email/queue', () => ({
  queueCommittedEmail: (...args: unknown[]) => mockQueueCommittedEmail(...args),
}));
jest.mock('@/lib/email/mailer', () => ({
  verifySmtp: (...args: unknown[]) => mockVerifySmtp(...args),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    jobOutbox: { create: jest.fn() },
  },
}));

describe('email-service', () => {
  beforeEach(() => {
    process.env.SMTP_FROM = 'noreply@test.com';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    mockQueueCommittedEmail.mockReset();
    mockQueueCommittedEmail.mockResolvedValue({ id: 'job-1' });
    mockVerifySmtp.mockReset();
    mockVerifySmtp.mockResolvedValue({ ok: true });
  });

  it('sends welcome email', async () => {
    const { sendWelcomeEmail } = await import('@/lib/email-service');
    await sendWelcomeEmail({ email: 'user@test.com', firstName: 'Alex' });
    expect(mockQueueCommittedEmail).toHaveBeenCalledTimes(1);
    expect(mockQueueCommittedEmail.mock.calls[0][0].to).toBe('user@test.com');
  });

  it('sends session confirmation to student and coach', async () => {
    const { sendSessionConfirmationEmail } = await import('@/lib/email-service');
    await sendSessionConfirmationEmail(
      {
        id: 'sess-1',
        subject: 'Maths',
        scheduledAt: new Date('2026-02-12T10:00:00Z'),
        duration: 60,
      },
      { email: 'student@test.com', firstName: 'Yasmine', lastName: 'Dupont' },
      { email: 'coach@test.com', name: 'Coach A' }
    );

    expect(mockQueueCommittedEmail).toHaveBeenCalledTimes(2);
    for (const [mail] of mockQueueCommittedEmail.mock.calls) {
      expect(mail.html).not.toMatch(/crédit|undefined/i);
      expect(mail.html).toContain('Maths');
      expect(mail.html).toContain('Yasmine');
      expect(mail.html).toContain('Coach A');
    }
  });

  it('sends session reminder email', async () => {
    const { sendSessionReminderEmail } = await import('@/lib/email-service');
    await sendSessionReminderEmail(
      {
        id: 'sess-2',
        subject: 'NSI',
        scheduledAt: new Date('2026-02-12T10:00:00Z'),
        duration: 45,
      },
      { email: 'student@test.com', firstName: 'Karim', lastName: 'Dupont' },
      'http://video.link'
    );
    expect(mockQueueCommittedEmail).toHaveBeenCalledTimes(1);
  });

  it('tests email configuration', async () => {
    const { testEmailConfiguration } = await import('@/lib/email-service');
    mockVerifySmtp.mockResolvedValueOnce({ ok: true });
    const result = await testEmailConfiguration();
    expect(result).toEqual({ success: true, message: 'Configuration email valide' });
  });

  it('sends session report notification', async () => {
    const { sendSessionReportNotification } = await import('@/lib/email-service');
    await sendSessionReportNotification(
      { id: 'sess-3', subject: 'Maths', scheduledDate: new Date('2026-02-12T10:00:00Z') },
      { firstName: 'Yasmine', lastName: 'Dupont' },
      { firstName: 'Coach', lastName: 'A' },
      {
        summary: 'Bien',
        performanceRating: 4,
        topicsCovered: 'Algèbre',
        recommendations: 'Réviser',
      },
      'parent@test.com'
    );
    expect(mockQueueCommittedEmail).toHaveBeenCalledTimes(1);
  });

  it('sendScheduledReminders sends reminders and updates sessions', async () => {
    const { prisma } = await import('@/lib/prisma');
    const { sendScheduledReminders } = await import('@/lib/email-service');

    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'sess-4',
        subject: 'Maths',
        scheduledDate: new Date(),
        startTime: '10:00',
        duration: 60,
        creditsUsed: 2,
        student: { email: 'student@test.com', firstName: 'Yasmine' },
        coach: { email: 'coach@test.com' },
      },
    ]);

    (prisma.sessionBooking.update as jest.Mock).mockResolvedValue({});

    await sendScheduledReminders();

    expect(prisma.sessionBooking.update).toHaveBeenCalledWith({
      where: { id: 'sess-4' },
      data: { reminderSent: true },
    });
  });
});
