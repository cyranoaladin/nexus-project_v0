import { auth } from '@/auth';
import { GET, PUT } from '@/app/api/aria/profile/route';
import {
  getAriaLearningProfileForActor,
  replaceAriaLearningProfileForActor,
} from '@/lib/aria/application/profile/public';
import { AriaError } from '@/lib/aria/errors';
import { createLogger } from '@/lib/middleware/logger';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/application/profile/public', () => ({
  getAriaLearningProfileForActor: jest.fn(),
  replaceAriaLearningProfileForActor: jest.fn(),
}));
jest.mock('@/lib/middleware/logger', () => ({ createLogger: jest.fn() }));

describe('/api/aria/profile strict V1 preferences', () => {
  const logger = {
    getRequestId: jest.fn(() => 'req-profile-1'),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (createLogger as jest.Mock).mockReturnValue(logger);
  });

  it('returns 401 for unauthenticated reads', async () => {
    (auth as jest.Mock).mockResolvedValueOnce(null);
    const response = await GET(new NextRequest('http://localhost/api/aria/profile'));
    expect(response.status).toBe(401);
    expect(getAriaLearningProfileForActor).not.toHaveBeenCalled();
  });

  it('reads through the application boundary', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    (getAriaLearningProfileForActor as jest.Mock).mockResolvedValueOnce({
      studentId: 'student-1',
      preferences: {
        version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
        courseOrder: [], showCitations: true,
      },
      updatedAt: '2026-08-30T18:00:00.000Z',
    });
    const response = await GET(new NextRequest('http://localhost/api/aria/profile'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: { preferences: { version: 1, pinnedCourseKeys: [] } },
    });
    expect(getAriaLearningProfileForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' },
    });
  });

  it.each([
    { selectedCourseKeys: ['eds-maths-terminale'] },
    { uiPreferences: { theme: 'dark' } },
    {
      version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
      courseOrder: [], showCitations: true, studentId: 'forged',
    },
    {
      version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
      courseOrder: [], showCitations: true, gradeLevel: 'TERMINALE',
    },
    {
      version: 1, pinnedCourseKeys: [], focusedCourseKey: null,
      courseOrder: [], showCitations: true, entitlement: 'ALL',
    },
    { version: 1, pinnedCourseKeys: [], focusedCourseKey: null, courseOrder: [] },
  ])('rejects incomplete and injected write bodies %#', async (body) => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    const response = await PUT(new NextRequest('http://localhost/api/aria/profile', {
      method: 'PUT', body: JSON.stringify(body),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'BAD_REQUEST' } });
    expect(replaceAriaLearningProfileForActor).not.toHaveBeenCalled();
  });

  it('A012 replaces one complete strict preference document', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    const preferences = {
      version: 1,
      pinnedCourseKeys: ['eds-maths-terminale'],
      focusedCourseKey: 'eds-maths-terminale',
      courseOrder: ['eds-maths-terminale'],
      showCitations: false,
    };
    (replaceAriaLearningProfileForActor as jest.Mock).mockResolvedValueOnce({
      studentId: 'student-1', preferences, updatedAt: '2026-08-30T18:00:00.000Z',
    });
    const response = await PUT(new NextRequest('http://localhost/api/aria/profile', {
      method: 'PUT', body: JSON.stringify(preferences),
    }));
    expect(response.status).toBe(200);
    expect(replaceAriaLearningProfileForActor).toHaveBeenCalledWith({
      actor: { userId: 'user-1', role: 'ELEVE' }, preferences,
    });
  });

  it('rejects a profile body over the ARIA mutation byte budget before application writes', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    const response = await PUT(new NextRequest('http://localhost/api/aria/profile', {
      method: 'PUT', body: 'x'.repeat(8_193), headers: { 'content-length': '1' },
    }));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'PAYLOAD_TOO_LARGE' },
    });
    expect(replaceAriaLearningProfileForActor).not.toHaveBeenCalled();
  });

  it('redacts internal profile failures', async () => {
    (auth as jest.Mock).mockResolvedValueOnce({ user: { id: 'user-1', role: 'ELEVE' } });
    (getAriaLearningProfileForActor as jest.Mock).mockRejectedValueOnce(
      new AriaError('INTERNAL_ERROR', 500, '/private/path account@example.test'),
    );
    const response = await GET(new NextRequest('http://localhost/api/aria/profile'));
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain('INTERNAL_ERROR');
    expect(body).not.toMatch(/private|example\.test/i);
  });
});
