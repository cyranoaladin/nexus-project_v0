/**
 * Programme Maths Terminale Progress API — Complete Test Suite
 *
 * Tests: GET & POST /api/programme/maths-terminale/progress
 *
 * Source: app/api/programme/maths-terminale/progress/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { GET, POST } from '@/app/api/programme/maths-terminale/progress/route';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

const mockAuth = auth as jest.Mock;
const mockCreateClient = createClient as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

const validPayload = {
  completed_chapters: ['ch1'],
  mastered_chapters: [],
  total_xp: 100,
  quiz_score: 80,
  combo_count: 3,
  best_combo: 5,
  streak: 2,
  streak_freezes: 0,
  last_activity_date: '2026-02-15',
  daily_challenge: {},
  exercise_results: {},
  hint_usage: {},
  badges: ['first_step'],
  srs_queue: {},
};

// ─── GET ─────────────────────────────────────────────────────────────────────

describe('GET /api/programme/maths-terminale/progress', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Authentication');
  });

  it('should return local-only when Supabase not configured', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('local-only');
  });

  it('should return data from Supabase when configured', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const mockSingle = jest.fn().mockResolvedValue({ data: { total_xp: 200 }, error: null });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
    mockCreateClient.mockReturnValue({ from: mockFrom } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.total_xp).toBe(200);
  });

  it('should return null data when no record found (PGRST116)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Not found' } });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
    mockCreateClient.mockReturnValue({ from: mockFrom } as any);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeNull();
  });
});

// ─── POST ────────────────────────────────────────────────────────────────────

describe('POST /api/programme/maths-terminale/progress', () => {
  function makeRequest(body: unknown): Request {
    return new Request('http://localhost:3000/api/programme/maths-terminale/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it('should return 400 for invalid payload', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await POST(makeRequest({ invalid: true }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid');
  });

  it('should return local-only when Supabase not configured', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await POST(makeRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.mode).toBe('local-only');
  });

  it('should persist to Supabase when configured', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert });
    mockCreateClient.mockReturnValue({ from: mockFrom } as any);

    const res = await POST(makeRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.persisted).toBe(true);
  });

  it('should return 500 on Supabase error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const mockUpsert = jest.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert });
    mockCreateClient.mockReturnValue({ from: mockFrom } as any);

    const res = await POST(makeRequest(validPayload));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.persisted).toBe(false);
  });
});
