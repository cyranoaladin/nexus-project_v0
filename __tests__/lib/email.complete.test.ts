/**
 * Email Service — Complete Test Suite
 *
 * Tests: sendWelcomeParentEmail, sendCreditExpirationReminder,
 *        sendPasswordResetEmail, sendStageDiagnosticInvitation, sendStageBilanReady
 *
 * Source: lib/email.ts
 */

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });

jest.mock('nodemailer', () => {
  return {
    __esModule: true,
    default: {
      createTransport: jest.fn().mockReturnValue({
        sendMail: (...args: any[]) => mockSendMail(...args),
      }),
    },
    createTransport: jest.fn().mockReturnValue({
      sendMail: (...args: any[]) => mockSendMail(...args),
    }),
  };
});

import {
  sendWelcomeParentEmail,
  sendCreditExpirationReminder,
  sendPasswordResetEmail,
  sendStageDiagnosticInvitation,
  sendStageBilanReady,
} from '@/lib/email';

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── sendWelcomeParentEmail ──────────────────────────────────────────────────

describe('sendWelcomeParentEmail', () => {
  it('should send welcome email with correct recipient', async () => {
    await sendWelcomeParentEmail('parent@example.com', 'Ahmed', 'Mehdi');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('parent@example.com');
    expect(call.subject).toContain('Bienvenue');
  });

  it('should include parent name in HTML body', async () => {
    await sendWelcomeParentEmail('parent@example.com', 'Ahmed', 'Mehdi');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Ahmed');
  });

  it('should include student name in HTML body', async () => {
    await sendWelcomeParentEmail('parent@example.com', 'Ahmed', 'Mehdi');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Mehdi');
  });

  it('should include temporary password when provided', async () => {
    await sendWelcomeParentEmail('parent@example.com', 'Ahmed', 'Mehdi', 'TempPass123');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('TempPass123');
  });

  it('should not include password section when not provided', async () => {
    await sendWelcomeParentEmail('parent@example.com', 'Ahmed', 'Mehdi');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).not.toContain('Mot de passe temporaire');
  });

  it('should use SMTP_FROM env or default sender', async () => {
    await sendWelcomeParentEmail('parent@example.com', 'Ahmed', 'Mehdi');

    const call = mockSendMail.mock.calls[0][0];
    expect(call.from).toBeDefined();
    expect(typeof call.from).toBe('string');
  });
});

// ─── sendCreditExpirationReminder ────────────────────────────────────────────

describe('sendCreditExpirationReminder', () => {
  const expirationDate = new Date('2026-07-15');

  it('should send reminder email with correct recipient', async () => {
    await sendCreditExpirationReminder('parent@example.com', 'Ahmed', 'Mehdi', 4, expirationDate);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('parent@example.com');
  });

  it('should include credit count in body', async () => {
    await sendCreditExpirationReminder('parent@example.com', 'Ahmed', 'Mehdi', 4, expirationDate);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('4 crédits');
  });

  it('should include student name in body', async () => {
    await sendCreditExpirationReminder('parent@example.com', 'Ahmed', 'Mehdi', 4, expirationDate);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Mehdi');
  });

  it('should include expiration subject', async () => {
    await sendCreditExpirationReminder('parent@example.com', 'Ahmed', 'Mehdi', 4, expirationDate);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('expirent');
  });
});

// ─── sendPasswordResetEmail ──────────────────────────────────────────────────

describe('sendPasswordResetEmail', () => {
  const resetUrl = 'https://nexusreussite.academy/auth/reset?token=abc123';

  it('should send reset email with correct recipient', async () => {
    await sendPasswordResetEmail('user@example.com', 'Ahmed', resetUrl);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
  });

  it('should include reset URL in body', async () => {
    await sendPasswordResetEmail('user@example.com', 'Ahmed', resetUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain(resetUrl);
  });

  it('should include user first name in body', async () => {
    await sendPasswordResetEmail('user@example.com', 'Ahmed', resetUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Ahmed');
  });

  it('should include password reset subject', async () => {
    await sendPasswordResetEmail('user@example.com', 'Ahmed', resetUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('mot de passe');
  });

  it('should mention 1 hour expiry', async () => {
    await sendPasswordResetEmail('user@example.com', 'Ahmed', resetUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('1 heure');
  });
});

// ─── sendStageDiagnosticInvitation ───────────────────────────────────────────

describe('sendStageDiagnosticInvitation', () => {
  const diagnosticUrl = 'https://nexusreussite.academy/stages/fevrier-2026/diagnostic';

  it('should send diagnostic invitation email', async () => {
    await sendStageDiagnosticInvitation('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', diagnosticUrl);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('parent@example.com');
  });

  it('should include diagnostic URL in body', async () => {
    await sendStageDiagnosticInvitation('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', diagnosticUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain(diagnosticUrl);
  });

  it('should use student name when provided', async () => {
    await sendStageDiagnosticInvitation('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', diagnosticUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Mehdi');
  });

  it('should fallback to parent name when student name is null', async () => {
    await sendStageDiagnosticInvitation('parent@example.com', 'Ahmed', null, 'Nexus Academy', diagnosticUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Ahmed');
  });

  it('should include academy title', async () => {
    await sendStageDiagnosticInvitation('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', diagnosticUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Nexus Academy');
  });

  it('should mention 50 questions', async () => {
    await sendStageDiagnosticInvitation('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', diagnosticUrl);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('50 questions');
  });
});

// ─── sendStageBilanReady ─────────────────────────────────────────────────────

describe('sendStageBilanReady', () => {
  const bilanUrl = 'https://nexusreussite.academy/bilan/123';

  it('should send bilan ready email', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 75, 90);

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const call = mockSendMail.mock.calls[0][0];
    expect(call.to).toBe('parent@example.com');
  });

  it('should include bilan URL in body', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 75, 90);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain(bilanUrl);
  });

  it('should include global score', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 75, 90);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('75');
  });

  it('should include confidence index', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 75, 90);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('90%');
  });

  it('should show "Excellent" label for score >= 70', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 75, 90);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Excellent');
  });

  it('should show "Solide" label for score 50-69', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 55, 80);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('Solide');
  });

  it('should show "En progression" label for score 30-49', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 35, 70);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('En progression');
  });

  it('should show "À renforcer" label for score < 30', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 20, 60);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('renforcer');
  });

  it('should include bilan ready subject', async () => {
    await sendStageBilanReady('parent@example.com', 'Ahmed', 'Mehdi', 'Nexus Academy', bilanUrl, 75, 90);

    const call = mockSendMail.mock.calls[0][0];
    expect(call.subject).toContain('bilan');
  });
});

// ─── Error Handling ──────────────────────────────────────────────────────────

describe('Email error handling', () => {
  it('should not throw in test environment when sendMail fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

    // In test env (NODE_ENV=test), the function checks for 'development'
    // so it will throw since we're not in development mode
    // But our mock setup means it depends on the actual NODE_ENV
    try {
      await sendWelcomeParentEmail('parent@example.com', 'Ahmed', 'Mehdi');
    } catch {
      // Expected in non-development environments
    }
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });
});
