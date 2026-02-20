import { GET } from '@/app/api/student/resources/route';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

function makeRequest() {
  return {} as any;
}

describe('GET /api/student/resources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not student', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns empty resources list for student', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE' },
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
  });
});
