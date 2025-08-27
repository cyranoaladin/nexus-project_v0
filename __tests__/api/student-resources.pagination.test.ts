import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/student/resources/route';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    pedagogicalContent: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

import { getServerSession } from 'next-auth';
const { prisma } = require('@/lib/prisma');

describe('GET /api/student/resources - pagination & filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as unknown as jest.Mock).mockResolvedValue({ user: { role: 'ELEVE' } });
  });

  it('paginates and returns metadata', async () => {
    prisma.pedagogicalContent.count.mockResolvedValue(5);
    prisma.pedagogicalContent.findMany.mockResolvedValue([
      { id: '3', title: 'Titre 3', content: 'x'.repeat(600), subject: 'MATHEMATIQUES', tags: '["fiche"]', updatedAt: new Date('2024-01-03') },
      { id: '4', title: 'Titre 4', content: 'Contenu', subject: 'MATHEMATIQUES', tags: '["exercice"]', updatedAt: new Date('2024-01-04') },
    ]);

    const req = { url: 'http://localhost/api/student/resources?subject=all&page=2&pageSize=2' } as unknown as NextRequest;
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await (res as Response).json();

    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(2);
    expect(body.total).toBe(5);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].description.length).toBe(300);
    expect(body.items[0].type).toBe('Fiche');
    expect(body.items[1].type).toBe('Exercices');
  });

  it('clamps pageSize to 50', async () => {
    prisma.pedagogicalContent.count.mockResolvedValue(60);
    prisma.pedagogicalContent.findMany.mockResolvedValue([]);

    const req = { url: 'http://localhost/api/student/resources?subject=all&page=1&pageSize=300' } as unknown as NextRequest;
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await (res as Response).json();
    expect(body.pageSize).toBe(50);

    const callArgs = prisma.pedagogicalContent.findMany.mock.calls[0][0];
    expect(callArgs.take).toBe(50);
  });

  it('applies subject and search filters', async () => {
    prisma.pedagogicalContent.count.mockResolvedValue(0);
    prisma.pedagogicalContent.findMany.mockResolvedValue([]);

    const req = { url: 'http://localhost/api/student/resources?subject=NSI&q=algo' } as unknown as NextRequest;
    await GET(req);

    const callArgs = prisma.pedagogicalContent.findMany.mock.calls[0][0];
    expect(callArgs.where.subject).toBe('NSI');

    const or = callArgs.where.OR || [];
    const hasAlgo = or.some((clause: any) => clause?.title?.contains === 'algo' && clause?.title?.mode === 'insensitive');
    expect(hasAlgo).toBe(true);
  });

  it('requires ELEVE session', async () => {
    (getServerSession as unknown as jest.Mock).mockResolvedValue(null);
    const req = { url: 'http://localhost/api/student/resources?subject=all' } as unknown as NextRequest;
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

