/**
 * Programme Maths 1ère Progress API — Complete Test Suite
 *
 * Tests: POST /api/programme/maths-1ere/progress
 *
 * Source: app/api/programme/maths-1ere/progress/route.ts
 */

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { POST } from '@/app/api/programme/maths-1ere/progress/route';
import { auth } from '@/auth';
import { createClient } from '@supabase/supabase-js';

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;

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

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/programme/maths-1ere/progress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/programme/maths-1ere/progress', () => {
  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null as any);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it('should return 503 when Supabase not configured', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(503);
  });

  it('should return 400 for invalid payload', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const res = await POST(makeRequest({ invalid: true }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid');
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
  });

  it('should return 500 on Supabase error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const mockUpsert = jest.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const mockFrom = jest.fn().mockReturnValue({ upsert: mockUpsert });
    mockCreateClient.mockReturnValue({ from: mockFrom } as any);

    const res = await POST(makeRequest(validPayload));
    expect(res.status).toBe(500);
  });

  it('should return 400 for invalid JSON', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } } as any);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const req = new Request('http://localhost:3000/api/programme/maths-1ere/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
