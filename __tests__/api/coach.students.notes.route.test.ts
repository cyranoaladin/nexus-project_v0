/**
 * Phase 6 — Coach private notes route
 * Tests RBAC + happy paths for GET (list) and POST (create).
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sessionBooking: { findFirst: jest.fn() },
    coachNote: { findMany: jest.fn(), create: jest.fn() },
  },
}));

import { GET, POST } from '@/app/api/coach/students/[studentId]/notes/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;

function ctx(studentId: string) {
  return { params: Promise.resolve({ studentId }) };
}

function jsonReq(body: unknown): Request {
  return new Request('http://localhost/api/coach/students/x/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/coach/students/[studentId]/notes', () => {
  it('401 when no session', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost/'), ctx('s1'));
    expect(res.status).toBe(401);
  });

  it('403 when role is PARENT', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'p1', role: 'PARENT' } });
    const res = await GET(new Request('http://localhost/'), ctx('s1'));
    expect(res.status).toBe(403);
  });

  it('403 when COACH is not rattached', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await GET(new Request('http://localhost/'), ctx('s-other'));
    expect(res.status).toBe(403);
    expect(prisma.coachNote.findMany).not.toHaveBeenCalled();
  });

  it('returns coach own notes when rattached', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'sb1' });
    (prisma.coachNote.findMany as jest.Mock).mockResolvedValue([
      { id: 'n1', body: 'good', pinned: true, coachId: 'c1', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const res = await GET(new Request('http://localhost/'), ctx('s1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notes).toHaveLength(1);
    expect(prisma.coachNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 's1', coachId: 'c1' },
      }),
    );
  });

  it('ADMIN sees all notes about the student (no coachId filter)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    (prisma.coachNote.findMany as jest.Mock).mockResolvedValue([]);

    const res = await GET(new Request('http://localhost/'), ctx('s1'));
    expect(res.status).toBe(200);
    expect(prisma.sessionBooking.findFirst).not.toHaveBeenCalled();
    expect(prisma.coachNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 's1' } }),
    );
  });
});

describe('POST /api/coach/students/[studentId]/notes', () => {
  it('401 when no session', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(jsonReq({ body: 'x' }), ctx('s1'));
    expect(res.status).toBe(401);
  });

  it('403 when role is ADMIN (creation reserved to COACH)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'a1', role: 'ADMIN' } });
    const res = await POST(jsonReq({ body: 'x' }), ctx('s1'));
    expect(res.status).toBe(403);
  });

  it('403 when COACH not rattached', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await POST(jsonReq({ body: 'note' }), ctx('s-other'));
    expect(res.status).toBe(403);
    expect(prisma.coachNote.create).not.toHaveBeenCalled();
  });

  it('400 on empty body', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'sb1' });

    const res = await POST(jsonReq({ body: '   ' }), ctx('s1'));
    expect(res.status).toBe(400);
  });

  it('400 on invalid JSON', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'sb1' });

    const req = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{',
    });
    const res = await POST(req, ctx('s1'));
    expect(res.status).toBe(400);
  });

  it('creates a note with sane defaults when COACH is rattached', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'c1', role: 'COACH' } });
    (prisma.sessionBooking.findFirst as jest.Mock).mockResolvedValue({ id: 'sb1' });
    (prisma.coachNote.create as jest.Mock).mockResolvedValue({
      id: 'n-new',
      body: 'progresses well',
      pinned: false,
      coachId: 'c1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await POST(jsonReq({ body: 'progresses well' }), ctx('s1'));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.note.id).toBe('n-new');
    expect(prisma.coachNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 's1',
          coachId: 'c1',
          body: 'progresses well',
          pinned: false,
        }),
      }),
    );
  });
});
