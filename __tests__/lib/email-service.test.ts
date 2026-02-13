var transport = {
  sendMail: jest.fn(),
  verify: jest.fn(),
};

jest.mock('nodemailer', () => {
  transport = {
    sendMail: jest.fn(),
    verify: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      createTransport: jest.fn(() => ({
        sendMail: transport.sendMail,
        verify: transport.verify,
      })),
    },
  };
});

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('email-service', () => {
  beforeEach(() => {
    process.env.SMTP_FROM = 'noreply@test.com';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    transport.sendMail.mockReset();
    transport.verify.mockReset();
  });

  it('sends welcome email', async () => {
    const { sendWelcomeEmail } = await import('@/lib/email-service');
    await sendWelcomeEmail({ email: 'user@test.com', firstName: 'Alex' });
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
    expect(transport.sendMail.mock.calls[0][0].to).toBe('user@test.com');
  });

  it('sends session confirmation to student and coach', async () => {
    const { sendSessionConfirmationEmail } = await import('@/lib/email-service');
    await sendSessionConfirmationEmail(
      {
        id: 'sess-1',
        subject: 'Maths',
        scheduledAt: new Date('2026-02-12T10:00:00Z'),
        duration: 60,
        creditCost: 2,
      },
      { email: 'student@test.com', firstName: 'Yasmine', lastName: 'Dupont' },
      { email: 'coach@test.com', name: 'Coach A' }
    );

    expect(transport.sendMail).toHaveBeenCalledTimes(2);
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
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  it('tests email configuration', async () => {
    const { testEmailConfiguration } = await import('@/lib/email-service');
    transport.verify.mockResolvedValueOnce(true);
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
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
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
