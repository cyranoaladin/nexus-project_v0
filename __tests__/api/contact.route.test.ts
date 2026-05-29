import { POST } from '@/app/api/contact/route';

function makeRequest(body: any) {
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('contact route', () => {
  it('returns 400 on missing required fields', async () => {
    const res = await POST(makeRequest({ name: '', email: '' }));
    const json = await (res as any).json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('missing_required');
  });

  it('returns ok on valid payload', async () => {
    const res = await POST(makeRequest({ name: 'Alex', email: 'a@test.com' }));
    const json = await (res as any).json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});
