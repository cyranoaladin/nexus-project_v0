/**
 * Assistant Activate Student API — Complete Test Suite
 *
 * Tests: POST /api/assistant/activate-student
 *
 * Source: app/api/assistant/activate-student/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/services/student-activation.service', () => ({
  initiateStudentActivation: jest.fn(),
}));

import { POST } from '@/app/api/assistant/activate-student/route';
import { auth } from '@/auth';
import { initiateStudentActivation } from '@/lib/services/student-activation.service';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockInitiate = initiateStudentActivation as jest.MockedFunction<typeof initiateStudentActivation>;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/assistant/activate-student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/assistant/activate-student', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
    expect(res.status).toBe(401);
  });

  it('should return 403 for unauthorized role (ELEVE)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ELEVE' } } as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
    expect(res.status).toBe(403);
  });

  it('should return 403 for COACH role', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'COACH' } } as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
    expect(res.status).toBe(403);
  });

  it('should return 400 for invalid email', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'not-email' }));
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing studentUserId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', role: 'ADMIN' } } as any);

    const res = await POST(makeRequest({ studentEmail: 'a@b.com' }));
    expect(res.status).toBe(400);
  });

  it('should activate student for ADMIN', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockInitiate.mockResolvedValue({
      success: true,
      activationUrl: 'http://localhost:3000/auth/activate?token=abc',
      studentName: 'Ahmed',
    } as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'ahmed@test.com' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.activationUrl).toContain('token=abc');
    expect(body.studentName).toBe('Ahmed');
    expect(mockInitiate).toHaveBeenCalledWith('u1', 'ahmed@test.com', 'ADMIN');
  });

  it('should activate student for ASSISTANTE', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ASSISTANTE' } } as any);
    mockInitiate.mockResolvedValue({ success: true, activationUrl: 'url', studentName: 'Test' } as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
    expect(res.status).toBe(200);
  });

  it('should activate student for PARENT', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'p1', role: 'PARENT' } } as any);
    mockInitiate.mockResolvedValue({ success: true, activationUrl: 'url', studentName: 'Test' } as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
    expect(res.status).toBe(200);
  });

  it('should return 400 when activation fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockInitiate.mockResolvedValue({ success: false, error: 'Student already activated' } as any);

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('already activated');
  });

  it('should return 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } } as any);
    mockInitiate.mockRejectedValue(new Error('DB error'));

    const res = await POST(makeRequest({ studentUserId: 'u1', studentEmail: 'a@b.com' }));
    expect(res.status).toBe(500);
  });
});
