import { POST } from '@/app/api/reservation/route';

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/reservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  it('returns 400 when missing fields', async () => {
    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('returns success when telegram not configured', async () => {
    const response = await POST(makeRequest({ parent: 'P', phone: '123', academyId: 'a1' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
