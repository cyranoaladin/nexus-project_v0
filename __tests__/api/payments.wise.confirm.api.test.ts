import { POST } from '@/app/api/payments/wise/confirm/route';
describe('Wise Confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST stores form data on payment metadata', async () => {
    const res = await POST();
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data).toEqual({ error: 'Wise supprimé' });
  });
});

