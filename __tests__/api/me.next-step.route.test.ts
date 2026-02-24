/**
 * Me Next Step API — Complete Test Suite
 *
 * Tests: GET /api/me/next-step
 *
 * Source: app/api/me/next-step/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/next-step-engine', () => ({
  getNextStep: jest.fn(),
}));

import { GET } from '@/app/api/me/next-step/route';
import { auth } from '@/auth';
import { getNextStep } from '@/lib/next-step-engine';

const mockAuth = auth as jest.Mock;
const mockGetNextStep = getNextStep as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/me/next-step', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Authentification');
  });

  it('should return next step for authenticated user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    } as any);
    mockGetNextStep.mockResolvedValue({
      key: 'book_session',
      title: 'Réserver une séance',
      description: 'Réservez votre prochaine séance de coaching',
      href: '/dashboard/eleve',
      priority: 'high',
    } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.step.key).toBe('book_session');
    expect(mockGetNextStep).toHaveBeenCalledWith('user-1');
  });

  it('should return 500 on engine error', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
    } as any);
    mockGetNextStep.mockRejectedValue(new Error('DB error'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain('Erreur');
  });

  it('should return null step when no action needed', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'PARENT' },
    } as any);
    mockGetNextStep.mockResolvedValue(null as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.step).toBeNull();
  });
});
