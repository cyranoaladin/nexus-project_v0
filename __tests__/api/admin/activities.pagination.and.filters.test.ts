jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin', role: 'ADMIN' } }),
}));

describe('Admin Activities - filters and pagination branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).session = (prisma as any).session || {};
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).subscription = (prisma as any).subscription || {};
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};
  });

  function seed({ sessions = [], users = [], subs = [], credits = [] }: any) {
    (prisma as any).session.findMany = jest.fn().mockResolvedValue(sessions);
    (prisma as any).user.findMany = jest.fn().mockResolvedValue(users);
    (prisma as any).subscription.findMany = jest.fn().mockResolvedValue(subs);
    (prisma as any).creditTransaction.findMany = jest.fn().mockResolvedValue(credits);
  }

  it('type=session filter', async () => {
    seed({
      sessions: [
        {
          id: 's1',
          subject: 'NSI',
          status: 'SCHEDULED',
          createdAt: new Date(),
          student: { user: { firstName: 'A', lastName: 'B' } },
          coach: { user: {}, pseudonym: 'Coach' },
        },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/activities?type=session'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activities.every((a: any) => a.type === 'session')).toBe(true);
  });

  it('type=subscription filter', async () => {
    seed({
      subs: [
        {
          id: 'sub1',
          planName: 'HYBRIDE',
          status: 'ACTIVE',
          createdAt: new Date(),
          student: { user: { firstName: 'E', lastName: 'F' } },
        },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(
      new NextRequest('http://localhost/api/admin/activities?type=subscription')
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activities.every((a: any) => a.type === 'subscription')).toBe(true);
  });

  it('type=credit filter', async () => {
    seed({
      credits: [
        {
          id: 'c1',
          type: 'USAGE',
          amount: -1,
          createdAt: new Date(),
          student: { user: { firstName: 'G', lastName: 'H' } },
        },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/activities?type=credit'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activities.every((a: any) => a.type === 'credit')).toBe(true);
  });

  it('search by coachName, description and subject', async () => {
    seed({
      sessions: [
        {
          id: 's1',
          subject: 'MATHEMATIQUES',
          status: 'COMPLETED',
          createdAt: new Date(),
          student: { user: { firstName: 'Alice', lastName: 'Z' } },
          coach: { user: {}, pseudonym: 'Helios' },
        },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    const res1 = await GET(new NextRequest('http://localhost/api/admin/activities?search=helios'));
    expect((await res1.json()).activities.length).toBeGreaterThan(0);
    const res2 = await GET(new NextRequest('http://localhost/api/admin/activities?search=Alice'));
    expect((await res2.json()).activities.length).toBeGreaterThan(0);
    const res3 = await GET(
      new NextRequest('http://localhost/api/admin/activities?search=mathematiques')
    );
    expect((await res3.json()).activities.length).toBeGreaterThan(0);
  });

  it('pagination branches (page 2 shorter)', async () => {
    const base = Array.from({ length: 15 }, (_, i) => ({
      id: `s${i}`,
      subject: 'NSI',
      status: 'SCHEDULED',
      createdAt: new Date(),
      student: { user: { firstName: 'A', lastName: 'B' } },
      coach: { user: {}, pseudonym: 'Coach' },
    }));
    seed({ sessions: base });
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/activities?page=2&limit=10'));
    const json = await res.json();
    expect(json.activities.length).toBe(5);
    expect(json.pagination.totalPages).toBe(2);
  });

  it('action branches: COMPLETED, SCHEDULED, CANCELLED, and default else', async () => {
    const now = new Date();
    seed({
      sessions: [
        {
          id: 's1',
          subject: 'NSI',
          status: 'COMPLETED',
          createdAt: now,
          student: { user: { firstName: 'A', lastName: 'B' } },
          coach: { user: {}, pseudonym: 'Coach' },
        },
        {
          id: 's2',
          subject: 'NSI',
          status: 'SCHEDULED',
          createdAt: now,
          student: { user: { firstName: 'C', lastName: 'D' } },
          coach: { user: {}, pseudonym: 'Coach' },
        },
        {
          id: 's3',
          subject: 'NSI',
          status: 'CANCELLED',
          createdAt: now,
          student: { user: { firstName: 'E', lastName: 'F' } },
          coach: { user: {}, pseudonym: 'Coach' },
        },
        {
          id: 's4',
          subject: 'NSI',
          status: 'IN_PROGRESS',
          createdAt: now,
          student: { user: { firstName: 'G', lastName: 'H' } },
          coach: { user: {}, pseudonym: 'Coach' },
        },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/activities?type=session'));
    const json = await res.json();
    const actions = json.activities.reduce((acc: Record<string, number>, a: any) => {
      acc[a.action] = (acc[a.action] || 0) + 1;
      return acc;
    }, {});
    expect(actions['Session terminée']).toBeGreaterThan(0);
    expect(actions['Session programmée']).toBeGreaterThan(0);
    expect(actions['Session annulée']).toBeGreaterThan(0);
    expect(actions['Session en cours']).toBeGreaterThan(0);
  });

  it('search negative yields 0 results', async () => {
    seed({
      users: [
        { id: 'u1', firstName: 'Alice', lastName: 'Z', role: 'ELEVE', createdAt: new Date() },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(
      new NextRequest('http://localhost/api/admin/activities?type=user&search=notfound')
    );
    const json = await res.json();
    expect(json.activities.length).toBe(0);
  });

  it('pagination page out of range returns empty list', async () => {
    const base = Array.from({ length: 15 }, (_, i) => ({
      id: `s${i}`,
      subject: 'NSI',
      status: 'SCHEDULED',
      createdAt: new Date(),
      student: { user: { firstName: 'A', lastName: 'B' } },
      coach: { user: {}, pseudonym: 'Coach' },
    }));
    seed({ sessions: base });
    const { GET } = require('@/app/api/admin/activities/route');
    const res = await GET(
      new NextRequest('http://localhost/api/admin/activities?page=3&limit=10&type=session')
    );
    const json = await res.json();
    expect(json.activities.length).toBe(0);
    expect(json.pagination.totalPages).toBe(2);
  });

  it('handles missing nested fields (Unknown names) and allows searching fallback labels', async () => {
    const now = new Date();
    seed({
      sessions: [
        {
          id: 's1',
          subject: 'NSI',
          status: 'COMPLETED',
          createdAt: now,
          student: null,
          coach: null,
        },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    // Without search, activity should still be returned with fallback labels
    let res = await GET(new NextRequest('http://localhost/api/admin/activities?type=session'));
    let json = await res.json();
    expect(json.activities.length).toBe(1);
    // Search Unknown Coach should match fallback
    res = await GET(
      new NextRequest('http://localhost/api/admin/activities?type=session&search=unknown%20coach')
    );
    json = await res.json();
    expect(json.activities.length).toBe(1);
  });

  it('search across subscriptions and credits (subject/description lowercased)', async () => {
    const now = new Date();
    seed({
      subs: [
        {
          id: 'sub1',
          planName: 'HYBRIDE',
          status: 'ACTIVE',
          createdAt: now,
          student: { user: { firstName: 'Jean', lastName: 'Valjean' } },
        },
      ],
      credits: [
        {
          id: 'c1',
          type: 'REFUND',
          amount: 1,
          createdAt: now,
          student: { user: { firstName: 'Cosette', lastName: 'L.' } },
        },
      ],
    });
    const { GET } = require('@/app/api/admin/activities/route');
    // Search by planName in subject
    let res = await GET(new NextRequest('http://localhost/api/admin/activities?search=hybride'));
    let json = await res.json();
    expect(json.activities.find((a: any) => a.type === 'subscription')).toBeTruthy();

    // Search by credit type in subject
    res = await GET(new NextRequest('http://localhost/api/admin/activities?search=refund'));
    json = await res.json();
    expect(json.activities.find((a: any) => a.type === 'credit')).toBeTruthy();
  });

  it('pagination with limit=1 produces multiple pages and correct slicing', async () => {
    const base = Array.from({ length: 3 }, (_, i) => ({
      id: `s${i}`,
      subject: 'NSI',
      status: 'SCHEDULED',
      createdAt: new Date(Date.now() + i * 1000),
      student: { user: { firstName: 'A', lastName: 'B' } },
      coach: { user: {}, pseudonym: 'Coach' },
    }));
    seed({ sessions: base });
    const { GET } = require('@/app/api/admin/activities/route');
    let res = await GET(
      new NextRequest('http://localhost/api/admin/activities?limit=1&page=1&type=session')
    );
    let json = await res.json();
    expect(json.activities.length).toBe(1);
    expect(json.pagination.totalPages).toBe(3);

    res = await GET(
      new NextRequest('http://localhost/api/admin/activities?limit=1&page=3&type=session')
    );
    json = await res.json();
    expect(json.activities.length).toBe(1);
  });
});
