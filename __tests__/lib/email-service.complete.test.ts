/**
 * Email Service — Complete Test Suite
 *
 * Tests: sendWelcomeEmail, sendSessionConfirmationEmail,
 *        sendSessionReminderEmail, testEmailConfiguration,
 *        sendSessionReportNotification
 *
 * Source: lib/email-service.ts
 */

jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'mock-id' });
  const verify = jest.fn().mockResolvedValue(true);
  return {
    createTransport: jest.fn().mockReturnValue({ sendMail, verify }),
    __mockSendMail: sendMail,
    __mockVerify: verify,
  };
});

import {
  sendWelcomeEmail,
  sendSessionConfirmationEmail,
  sendSessionReminderEmail,
  testEmailConfiguration,
  sendSessionReportNotification,
} from '@/lib/email-service';

const { __mockSendMail: mockSendMail, __mockVerify: mockVerify } = require('nodemailer');

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── sendWelcomeEmail ────────────────────────────────────────────────────────

describe('sendWelcomeEmail', () => {
  it('should send welcome email to user', async () => {
    await sendWelcomeEmail({ firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed@test.com' });

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ahmed@test.com',
        subject: expect.stringContaining('Bienvenue'),
      })
    );
  });

  it('should include user first name in HTML', async () => {
    await sendWelcomeEmail({ firstName: 'Sara', lastName: 'Test', email: 'sara@test.com' });

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Sara');
  });

  it('should throw on sendMail failure', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    await expect(
      sendWelcomeEmail({ firstName: 'Test', lastName: 'User', email: 'test@test.com' })
    ).rejects.toThrow('SMTP error');
  });
});

// ─── sendSessionConfirmationEmail ────────────────────────────────────────────

describe('sendSessionConfirmationEmail', () => {
  const session = {
    id: 'sess-1',
    subject: 'MATHS',
    scheduledAt: new Date('2026-07-15T10:00:00Z'),
    duration: 60,
    creditCost: 1,
  };
  const student = { firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed@test.com' };

  it('should send confirmation to student', async () => {
    await sendSessionConfirmationEmail(session, student);

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ahmed@test.com',
        subject: expect.stringContaining('Confirmation'),
      })
    );
  });

  it('should include session details in HTML', async () => {
    await sendSessionConfirmationEmail(session, student);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('MATHS');
    expect(call.html).toContain('60');
  });

  it('should also send to coach when provided', async () => {
    const coach = { name: 'Coach Mehdi', firstName: 'Mehdi', lastName: 'Coach', email: 'coach@test.com' };

    await sendSessionConfirmationEmail(session, student, coach);

    expect(mockSendMail).toHaveBeenCalledTimes(2);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'coach@test.com' })
    );
  });

  it('should not send to coach when no email', async () => {
    const coach = { name: 'Coach', firstName: 'Coach', lastName: 'X', email: null };

    await sendSessionConfirmationEmail(session, student, coach);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('should throw on sendMail failure', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    await expect(
      sendSessionConfirmationEmail(session, student)
    ).rejects.toThrow('SMTP error');
  });
});

// ─── sendSessionReminderEmail ────────────────────────────────────────────────

describe('sendSessionReminderEmail', () => {
  const session = {
    id: 'sess-1',
    subject: 'NSI',
    scheduledAt: new Date('2026-07-15T14:00:00Z'),
    duration: 90,
  };
  const student = { firstName: 'Sara', lastName: 'Test', email: 'sara@test.com' };

  it('should send reminder email to student', async () => {
    await sendSessionReminderEmail(session, student, 'https://meet.jit.si/room-123');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'sara@test.com',
        subject: expect.stringContaining('Rappel'),
      })
    );
  });

  it('should include video link in HTML', async () => {
    await sendSessionReminderEmail(session, student, 'https://meet.jit.si/room-123');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('https://meet.jit.si/room-123');
  });

  it('should include session subject', async () => {
    await sendSessionReminderEmail(session, student, 'https://link');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('NSI');
  });
});

// ─── testEmailConfiguration ──────────────────────────────────────────────────

describe('testEmailConfiguration', () => {
  it('should return success when SMTP is valid', async () => {
    mockVerify.mockResolvedValueOnce(true);

    const result = await testEmailConfiguration();

    expect(result.success).toBe(true);
    expect(result.message).toContain('valide');
  });

  it('should return failure when SMTP is invalid', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await testEmailConfiguration();

    expect(result.success).toBe(false);
    expect(result.error).toContain('Connection refused');
  });
});

// ─── sendSessionReportNotification ───────────────────────────────────────────

describe('sendSessionReportNotification', () => {
  const session = { subject: 'MATHS', scheduledDate: new Date('2026-07-15'), id: 'sess-1' };
  const student = { firstName: 'Ahmed', lastName: 'Ben Ali' };
  const coach = { firstName: 'Mehdi', lastName: 'Coach' };
  const report = {
    summary: 'Good session',
    performanceRating: 4,
    topicsCovered: 'Algebra, Analysis',
    recommendations: 'Practice more exercises',
  };

  it('should send report notification to parent', async () => {
    await sendSessionReportNotification(session, student, coach, report, 'parent@test.com');

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'parent@test.com',
        subject: expect.stringContaining('compte-rendu'),
      })
    );
  });

  it('should include student name in subject', async () => {
    await sendSessionReportNotification(session, student, coach, report, 'parent@test.com');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('Ahmed');
    expect(call.subject).toContain('Ben Ali');
  });

  it('should include report details in HTML', async () => {
    await sendSessionReportNotification(session, student, coach, report, 'parent@test.com');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Good session');
    expect(call.html).toContain('Algebra, Analysis');
    expect(call.html).toContain('Practice more exercises');
  });

  it('should include performance stars', async () => {
    await sendSessionReportNotification(session, student, coach, report, 'parent@test.com');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('⭐');
  });

  it('should not throw on sendMail failure', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    // sendSessionReportNotification catches errors internally
    await expect(
      sendSessionReportNotification(session, student, coach, report, 'parent@test.com')
    ).resolves.toBeUndefined();
  });
});
