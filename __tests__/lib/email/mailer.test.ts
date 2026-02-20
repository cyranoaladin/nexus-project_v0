/**
 * Unit tests for lib/email/mailer.ts
 *
 * All tests mock nodemailer — zero network calls.
 */

/* eslint-disable no-var */
var mockSendMail = jest.fn();
var mockVerify = jest.fn();
/* eslint-enable no-var */

jest.mock('nodemailer', () => {
  mockSendMail = jest.fn();
  mockVerify = jest.fn();
  return {
    __esModule: true,
    default: {
      createTransport: jest.fn(() => ({
        sendMail: mockSendMail,
        verify: mockVerify,
      })),
    },
  };
});

import {
  sendMail,
  verifySmtp,
  isMailDisabled,
  resolveFrom,
  resolveReplyTo,
  resetTransporter,
} from '@/lib/email/mailer';

describe('lib/email/mailer', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    resetTransporter();
    // Reset env to known state
    process.env = { ...originalEnv };
    (process.env as any).NODE_ENV = 'test';
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'user@test.com';
    process.env.SMTP_PASS = 'secret';
    process.env.MAIL_FROM = 'Test <test@test.com>';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ─── isMailDisabled ─────────────────────────────────────────────────────

  describe('isMailDisabled', () => {
    it('returns true when MAIL_DISABLED=true', () => {
      process.env.MAIL_DISABLED = 'true';
      expect(isMailDisabled()).toBe(true);
    });

    it('returns false when MAIL_DISABLED=false even in test', () => {
      process.env.MAIL_DISABLED = 'false';
      (process.env as any).NODE_ENV = 'test';
      expect(isMailDisabled()).toBe(false);
    });

    it('defaults to true in NODE_ENV=test', () => {
      delete process.env.MAIL_DISABLED;
      (process.env as any).NODE_ENV = 'test';
      expect(isMailDisabled()).toBe(true);
    });

    it('defaults to false in NODE_ENV=production', () => {
      delete process.env.MAIL_DISABLED;
      (process.env as any).NODE_ENV = 'production';
      expect(isMailDisabled()).toBe(false);
    });
  });

  // ─── resolveFrom / resolveReplyTo ───────────────────────────────────────

  describe('resolveFrom', () => {
    it('prefers MAIL_FROM over others', () => {
      process.env.MAIL_FROM = 'A';
      process.env.EMAIL_FROM = 'B';
      process.env.SMTP_FROM = 'C';
      expect(resolveFrom()).toBe('A');
    });

    it('falls back to EMAIL_FROM', () => {
      delete process.env.MAIL_FROM;
      process.env.EMAIL_FROM = 'B';
      expect(resolveFrom()).toBe('B');
    });

    it('falls back to SMTP_FROM', () => {
      delete process.env.MAIL_FROM;
      delete process.env.EMAIL_FROM;
      process.env.SMTP_FROM = 'C';
      expect(resolveFrom()).toBe('C');
    });

    it('returns default when nothing set', () => {
      delete process.env.MAIL_FROM;
      delete process.env.EMAIL_FROM;
      delete process.env.SMTP_FROM;
      expect(resolveFrom()).toContain('no-reply@nexusreussite.academy');
    });
  });

  describe('resolveReplyTo', () => {
    it('returns MAIL_REPLY_TO if set', () => {
      process.env.MAIL_REPLY_TO = 'reply@test.com';
      expect(resolveReplyTo()).toBe('reply@test.com');
    });

    it('returns undefined when not set', () => {
      delete process.env.MAIL_REPLY_TO;
      delete process.env.EMAIL_REPLY_TO;
      expect(resolveReplyTo()).toBeUndefined();
    });
  });

  // ─── sendMail ───────────────────────────────────────────────────────────

  describe('sendMail', () => {
    it('skips when MAIL_DISABLED=true', async () => {
      process.env.MAIL_DISABLED = 'true';
      const result = await sendMail({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });
      expect(result).toEqual({ ok: true, skipped: true });
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('skips by default in NODE_ENV=test', async () => {
      delete process.env.MAIL_DISABLED;
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'test', writable: true, configurable: true });
      const result = await sendMail({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });
      expect(result).toEqual({ ok: true, skipped: true });
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('sends when MAIL_DISABLED=false', async () => {
      process.env.MAIL_DISABLED = 'false';
      mockSendMail.mockResolvedValueOnce({ messageId: '<abc@test>' });

      const result = await sendMail({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(result).toEqual({ ok: true, messageId: '<abc@test>' });
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const call = mockSendMail.mock.calls[0][0];
      expect(call.from).toBe('Test <test@test.com>');
      expect(call.to).toBe('user@test.com');
      expect(call.subject).toBe('Test');
      expect(call.html).toBe('<p>Hello</p>');
      expect(call.text).toBe('Hello');
    });

    it('uses replyTo from options over env', async () => {
      process.env.MAIL_DISABLED = 'false';
      process.env.MAIL_REPLY_TO = 'env@test.com';
      mockSendMail.mockResolvedValueOnce({ messageId: '<x>' });

      await sendMail({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hi</p>',
        replyTo: 'override@test.com',
      });

      expect(mockSendMail.mock.calls[0][0].replyTo).toBe('override@test.com');
    });

    it('throws in production on send failure', async () => {
      process.env.MAIL_DISABLED = 'false';
      (process.env as any).NODE_ENV = 'production';
      mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));

      await expect(
        sendMail({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' })
      ).rejects.toThrow('SMTP down');
    });

    it('swallows errors in development', async () => {
      process.env.MAIL_DISABLED = 'false';
      (process.env as any).NODE_ENV = 'development';
      mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));

      const result = await sendMail({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hi</p>',
      });

      expect(result).toEqual({ ok: false });
    });
  });

  // ─── verifySmtp ─────────────────────────────────────────────────────────

  describe('verifySmtp', () => {
    it('returns ok when disabled', async () => {
      process.env.MAIL_DISABLED = 'true';
      const result = await verifySmtp();
      expect(result).toEqual({ ok: true });
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it('returns ok on successful verify', async () => {
      process.env.MAIL_DISABLED = 'false';
      mockVerify.mockResolvedValueOnce(true);
      const result = await verifySmtp();
      expect(result).toEqual({ ok: true });
    });

    it('returns error on failed verify', async () => {
      process.env.MAIL_DISABLED = 'false';
      mockVerify.mockRejectedValueOnce(new Error('Auth failed'));
      const result = await verifySmtp();
      expect(result).toEqual({ ok: false, error: 'Auth failed' });
    });
  });
});
