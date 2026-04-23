/**
 * Bilans API — IDOR/Ownership Tests
 *
 * Tests: GET /api/bilans
 *        POST /api/bilans
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/bilans/route';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

const mockAuth = auth as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeGetRequest(searchParams: string = ''): NextRequest {
  return new NextRequest(`http://localhost:3000/api/bilans${searchParams}`, {
    method: 'GET',
  });
}

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api/bilans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('/api/bilans — IDOR Prevention', () => {
  it('✅ ADMIN peut lister tous les bilans sans filtre forcé', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN', email: 'admin@test.com' } });
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bilan.count as jest.Mock).mockResolvedValue(0);

    const res = await GET(makeGetRequest());
    
    expect(res.status).toBe(200);
    expect(prisma.bilan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {}
    }));
  });

  it('✅ COACH ne voit que ses propres bilans même sans paramètre coachId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH', email: 'coach@test.com' } });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1', userId: 'coach-1' });
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bilan.count as jest.Mock).mockResolvedValue(0);

    const res = await GET(makeGetRequest());
    
    expect(res.status).toBe(200);
    // Le where DOIT contenir coachId = 'coach-profile-1'
    expect(prisma.bilan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { coachId: 'coach-profile-1' }
    }));
  });

  it('🔴 COACH tente de voir les bilans dun autre coach via paramètre — DOIT échouer (override)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH', email: 'coach@test.com' } });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1', userId: 'coach-1' });
    (prisma.bilan.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.bilan.count as jest.Mock).mockResolvedValue(0);

    const res = await GET(makeGetRequest('?coachId=autre-coach-profile'));
    
    expect(res.status).toBe(200);
    // Le système DOIT forcer 'coach-profile-1' et ignorer 'autre-coach-profile'
    expect(prisma.bilan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { coachId: 'coach-profile-1' }
    }));
  });

  it('🔴 COACH tente de créer un bilan pour un autre coach — 403', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH', email: 'coach@test.com' } });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1', userId: 'coach-1' });

    const res = await POST(makePostRequest({
      type: 'DIAGNOSTIC',
      subject: 'Mathématiques',
      studentEmail: 'test@test.com',
      studentName: 'Test Eleve',
      coachId: 'autre-coach-profile', // usurpation
    }));
    
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Interdit');
  });

  it('✅ COACH crée un bilan avec son propre coachId', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH', email: 'coach@test.com' } });
    (prisma.coachProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'coach-profile-1', userId: 'coach-1' });
    (prisma.bilan.create as jest.Mock).mockResolvedValue({ id: 'bilan-new' });

    const res = await POST(makePostRequest({
      type: 'DIAGNOSTIC',
      subject: 'Mathématiques',
      studentEmail: 'test@test.com',
      studentName: 'Test Eleve',
      coachId: 'coach-profile-1',
    }));
    
    expect(res.status).toBe(201);
  });
});
