import { POST } from '@/app/api/parent/children/[studentId]/activation/route';
import { auth } from '@/auth';
import { checkCsrf } from '@/lib/csrf';
import { initiateParentOwnedStudentActivation } from '@/lib/services/student-activation.service';
import { NextRequest, NextResponse } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/csrf', () => ({ checkCsrf: jest.fn() }));
jest.mock('@/lib/services/student-activation.service', () => ({
  initiateParentOwnedStudentActivation: jest.fn(),
}));

const mockAuth = auth as jest.Mock;
const mockCheckCsrf = checkCsrf as jest.Mock;
const mockInitiate = initiateParentOwnedStudentActivation as jest.Mock;

function request(): NextRequest {
  return new NextRequest('http://localhost/api/parent/children/student-1/activation', {
    method: 'POST',
    headers: { Origin: 'http://localhost', Host: 'localhost' },
  });
}

const context = { params: Promise.resolve({ studentId: 'student-1' }) };

describe('POST /api/parent/children/[studentId]/activation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckCsrf.mockReturnValue(null);
    mockAuth.mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', email: 'parent@example.test' },
    });
  });

  it('issues an activation only from the authenticated parent ownership', async () => {
    mockInitiate.mockResolvedValue({
      success: true,
      activationUrl: 'http://localhost/auth/activate?token=act_raw_once',
      expiresAt: new Date('2026-08-06T10:00:00.000Z'),
      loginIdentifier: 'child@nexus-student.local',
      studentName: 'Enfant Test',
    });

    const response = await POST(request(), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockInitiate).toHaveBeenCalledWith({
      parentUserId: 'parent-1',
      studentId: 'student-1',
    });
    expect(body).toEqual({
      activation: {
        activationUrl: 'http://localhost/auth/activate?token=act_raw_once',
        expiresAt: '2026-08-06T10:00:00.000Z',
        loginIdentifier: 'child@nexus-student.local',
        studentName: 'Enfant Test',
      },
    });
    expect(JSON.stringify(body)).not.toContain('tokenHash');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('returns 404 for another family without revealing the student', async () => {
    mockInitiate.mockResolvedValue({ success: false, error: 'NOT_FOUND' });

    const response = await POST(request(), context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  it('returns 404 for an unauthenticated or non-parent caller', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'student-user', role: 'ELEVE' } });

    const response = await POST(request(), context);

    expect(response.status).toBe(404);
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it('applies the CSRF guard before issuing a token', async () => {
    mockCheckCsrf.mockReturnValue(NextResponse.json({ error: 'Forbidden' }, { status: 403 }));

    const response = await POST(request(), context);

    expect(response.status).toBe(403);
    expect(mockInitiate).not.toHaveBeenCalled();
  });

  it('maps a database identifier collision to a stable conflict without leaking details', async () => {
    mockInitiate.mockRejectedValue(Object.assign(new Error('unique email collision'), {
      code: 'P2002',
      meta: { target: ['email'] },
    }));

    const response = await POST(request(), context);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'STUDENT_LOGIN_IDENTIFIER_CONFLICT' });
  });

  it('never logs or returns an activation token from an unexpected failure', async () => {
    const token = 'act_secret_must_not_leak';
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockInitiate.mockRejectedValue(new Error(token));

    const response = await POST(request(), context);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain(token);
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
    log.mockRestore();
  });
});
