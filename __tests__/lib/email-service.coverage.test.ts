/**
 * Tests for lib/email.ts — Coverage boost
 *
 * Covers: createTransporter branches, sendWelcomeParentEmail, sendCreditExpirationReminder,
 * sendPasswordResetEmail, sendStageDiagnosticInvitation, sendStageBilanReady
 */

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
jest.mock('@/lib/email/queue', () => ({
  queueCommittedEmail: (...args: unknown[]) => mockSendMail(...args),
}));

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
      expect(call.subject).toContain('bilan');
    });

    it('includes activation link when provided', async () => {
      await sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim', 'https://nexusreussite.academy/auth/activate?token=abc');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain('/auth/activate?token=abc');
    });

    it('does not include password section when not provided', async () => {
      await sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).not.toContain('Mot de passe temporaire');
    });

    it('propagates durable enqueue failure in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendWelcomeParentEmail('parent@test.com', 'Marie', 'Karim')
      ).rejects.toThrow('smtp down');
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
    it.each(['development', 'production'])('does not enqueue obsolete reminders in %s', async environment => {
      setNodeEnv(environment);
      await sendCreditExpirationReminder('p@t.com', 'M', 'K', 3, new Date());
      expect(mockSendMail).not.toHaveBeenCalled();
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

    it('propagates durable enqueue failure in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendPasswordResetEmail('u@t.com', 'J', 'http://reset')
      ).rejects.toThrow('smtp down');
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

    it('propagates durable enqueue failure in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendStageDiagnosticInvitation('e@t.com', 'M', 'K', 'A', 'http://d')
      ).rejects.toThrow('smtp down');
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

    it('propagates durable enqueue failure in development mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('development');
      await expect(
        sendStageBilanReady('s@t.com', 'M', 'K', 'A', 'http://b', 50, 50)
      ).rejects.toThrow('smtp down');
    });

    it('throws error in production mode', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('smtp down'));
      setNodeEnv('production');
      await expect(
        sendStageBilanReady('s@t.com', 'M', 'K', 'A', 'http://b', 50, 50)
      ).rejects.toThrow('smtp down');
    });
  });

  describe('canonical worker boundary', () => {
    it('does not resolve the sender in the compatibility facade', async () => {
      delete process.env.SMTP_FROM;
      await sendWelcomeParentEmail('t@t.com', 'T', 'T');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.aggregateType).toBe('LEGACY_EMAIL');
      expect(call).not.toHaveProperty('from');
    });

    it('still delegates sender resolution when SMTP_FROM is configured', async () => {
      process.env.SMTP_FROM = 'custom@nexus.com';
      await sendWelcomeParentEmail('t@t.com', 'T', 'T');
      const call = mockSendMail.mock.calls[0][0];
      expect(call.aggregateType).toBe('LEGACY_EMAIL');
      expect(call).not.toHaveProperty('from');
    });
  });
});
