/**
 * Tests for lib/email.ts — Coverage boost
 *
 * Covers: createTransporter branches, sendWelcomeParentEmail, sendCreditExpirationReminder,
 * sendPasswordResetEmail, sendStageDiagnosticInvitation, sendStageBilanReady
 */

// Mock nodemailer before importing
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

import nodemailer from 'nodemailer';
import {
  sendWelcomeParentEmail,
  sendCreditExpirationReminder,
  sendPasswordResetEmail,
  sendStageDiagnosticInvitation,
  sendStageBilanReady,
} from '@/lib/email';

/** Helper to set NODE_ENV without TS readonly complaint */
function setNodeEnv(val: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = val;
}

describe('Email Service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    setNodeEnv('development');
    process.env.SMTP_HOST = 'smtp.test.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_FROM = 'test@nexus.com';
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('sendWelcomeParentEmail', () => {
    it('sends email successfully', async () => {
      await sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.to).toBe('parent@test.com');
      expect(call.subject).toContain('Bienvenue');
    });

    it('includes temp password when provided', async () => {
      await sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim', 'tempPass123');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('tempPass123');
    });

    it('does not include password section when not provided', async () => {
      await sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).not.toContain('Mot de passe temporaire');
    });

    it('swallows error in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim')
      ).resolves.toBeUndefined();
    });

    it('throws error in production mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('production');
      await expect(
        sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim')
      ).rejects.toThrow('smtp down');
    });
  });

  describe('sendCreditExpirationReminder', () => {
    it('sends reminder email', async () => {
      await sendCreditExpirationReminder(
        'parent@test.com', 'Marie', 'Karim', 5, new Date('2026-03-01')
      );
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('crédits');
    });

    it('swallows error in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendCreditExpirationReminder('p@t.com', 'M', 'K', 3, new Date())
      ).resolves.toBeUndefined();
    });

    it('throws error in production mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('production');
      await expect(
        sendCreditExpirationReminder('p@t.com', 'M', 'K', 3, new Date())
      ).rejects.toThrow('smtp down');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends reset email', async () => {
      await sendPasswordResetEmail('user@test.com', 'Jean', 'http://localhost/reset?token=abc');
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('Réinitialisation');
      expect(call.html).toContain('http://localhost/reset?token=abc');
    });

    it('swallows error in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendPasswordResetEmail('u@t.com', 'J', 'http://reset')
      ).resolves.toBeUndefined();
    });

    it('throws error in production mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('production');
      await expect(
        sendPasswordResetEmail('u@t.com', 'J', 'http://reset')
      ).rejects.toThrow('smtp down');
    });
  });

  describe('sendStageDiagnosticInvitation', () => {
    it('sends diagnostic invitation', async () => {
      await sendStageDiagnosticInvitation(
        'student@test.com', 'Marie', 'Karim', 'Académie Ariana', 'http://diag'
      );
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.subject).toContain('Stage Février');
      expect(call.html).toContain('Karim');
    });

    it('uses parentName when studentName is null', async () => {
      await sendStageDiagnosticInvitation(
        'student@test.com', 'Marie', null, 'Académie Ariana', 'http://diag'
      );
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('Marie');
    });

    it('swallows error in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendStageDiagnosticInvitation('e@t.com', 'M', 'K', 'A', 'http://d')
      ).resolves.toBeUndefined();
    });

    it('throws error in production mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('production');
      await expect(
        sendStageDiagnosticInvitation('e@t.com', 'M', 'K', 'A', 'http://d')
      ).rejects.toThrow('smtp down');
    });
  });

  describe('sendStageBilanReady', () => {
    it('sends bilan ready email with Excellent label', async () => {
      await sendStageBilanReady('s@t.com', 'Marie', 'Karim', 'Académie', 'http://bilan', 85, 90);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('Excellent');
      expect(call.html).toContain('85');
    });

    it('sends bilan ready email with Solide label', async () => {
      await sendStageBilanReady('s@t.com', 'Marie', 'Karim', 'Académie', 'http://bilan', 55, 60);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('Solide');
    });

    it('sends bilan ready email with En progression label', async () => {
      await sendStageBilanReady('s@t.com', 'Marie', 'Karim', 'Académie', 'http://bilan', 35, 40);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('En progression');
    });

    it('sends bilan ready email with À renforcer label', async () => {
      await sendStageBilanReady('s@t.com', 'Marie', 'Karim', 'Académie', 'http://bilan', 15, 20);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('renforcer');
    });

    it('uses parentName when studentName is null', async () => {
      await sendStageBilanReady('s@t.com', 'Marie', null, 'Académie', 'http://bilan', 50, 50);
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('Marie');
    });

    it('swallows error in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendStageBilanReady('s@t.com', 'M', 'K', 'A', 'http://b', 50, 50)
      ).resolves.toBeUndefined();
    });

    it('throws error in production mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('production');
      await expect(
        sendStageBilanReady('s@t.com', 'M', 'K', 'A', 'http://b', 50, 50)
      ).rejects.toThrow('smtp down');
    });
  });

  describe('SMTP_FROM fallback', () => {
    it('uses default SMTP_FROM when not set', async () => {
      delete process.env.SMTP_FROM;
      await sendWelcomeParentEmail('t@t.com', 'T', 'T');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.from).toContain('Nexus Réussite');
    });

    it('uses custom SMTP_FROM when set', async () => {
      process.env.SMTP_FROM = 'custom@nexus.com';
      await sendWelcomeParentEmail('t@t.com', 'T', 'T');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.from).toBe('custom@nexus.com');
    });
  });
});
