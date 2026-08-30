import { auth } from '@/auth';
import { POST } from '@/app/api/aria/feedback/route';
import { recordAriaFeedbackForActor } from '@/lib/aria/application/feedback/public';
import { AriaError } from '@/lib/aria/errors';
import { checkAndAwardBadges } from '@/lib/badges';
import { createLogger } from '@/lib/middleware/logger';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/feedback/public', () => ({
  recordAriaFeedbackForActor: jest.fn(),
}));
jest.mock('@/lib/badges', () => ({
  checkAndAwardBadges: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/lib/middleware/logger', () => ({
  createLogger: jest.fn(),
}));

describe('POST /api/aria/feedback', () => {
  const logger = {
    getRequestId: jest.fn(() => 'req-feedback-1'),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createLogger as jest.Mock).mockReturnValue(logger);
    (checkAndAwardBadges as jest.Mock).mockResolvedValue([]);
  });

  function request(body: unknown) {
    return new Request('http://localhost/api/aria/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }) as never;
  }

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await POST(request({ messageId: 'msg-1', useful: true }));
    expect(response.status).toBe(401);
    expect(recordAriaFeedbackForActor).not.toHaveBeenCalled();
  });

  it.each([
    { messageId: 'msg-1', useful: true, studentId: 'forged' },
    { messageId: 'msg-1', useful: true, unknownField: true },
    { messageId: 'msg-1', feedback: true },
  ])('rejects strict write-contract injection %#', async (body) => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(recordAriaFeedbackForActor).not.toHaveBeenCalled();
  });

  it('records feedback through the application boundary and returns its persisted value', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (recordAriaFeedbackForActor as jest.Mock).mockResolvedValueOnce({
      id: 'feedback-1',
      messageId: 'msg-1',
      useful: false,
      reason: 'Trop rapide',
      updatedAt: '2026-08-30T18:00:00.000Z',
    });

    const response = await POST(request({
      messageId: 'msg-1', useful: false, reason: 'Trop rapide',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      feedback: { id: 'feedback-1', useful: false, reason: 'Trop rapide' },
    });
    expect(recordAriaFeedbackForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
      messageId: 'msg-1',
      useful: false,
      reason: 'Trop rapide',
    });
  });

  it('maps cross-student ownership to a stable public denial', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (recordAriaFeedbackForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('NOT_ENTITLED', 403, 'private account id should not leak'),
    );

    const response = await POST(request({ messageId: 'msg-other', useful: true }));
    expect(response.status).toBe(403);
    const body = await response.text();
    expect(body).toContain('NOT_ENTITLED');
    expect(body).not.toContain('private account id');
  });

  it('surfaces canonical persistence failures as redacted 500 errors', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (recordAriaFeedbackForActor as jest.Mock).mockRejectedValueOnce(
      new Error('/var/lib/postgresql secret@example.test provider-secret-fragment'),
    );

    const response = await POST(request({ messageId: 'msg-1', useful: true }));
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain('INTERNAL_ERROR');
    expect(body).not.toMatch(/postgresql|example\.test|provider-secret/i);
  });

  it('logs a structured warning when the best-effort badge side effect fails', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { role: 'ELEVE', id: 'user-1' } });
    (recordAriaFeedbackForActor as jest.Mock).mockResolvedValueOnce({
      id: 'feedback-1', messageId: 'msg-1', useful: true, reason: null,
      updatedAt: '2026-08-30T18:00:00.000Z',
    });
    (checkAndAwardBadges as jest.Mock).mockRejectedValueOnce(new Error('badge database unavailable'));

    const response = await POST(request({ messageId: 'msg-1', useful: true }));
    expect(response.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith('ARIA secondary operation failed', {
      requestId: 'req-feedback-1',
      operation: 'award_feedback_badges',
    });
  });
});
