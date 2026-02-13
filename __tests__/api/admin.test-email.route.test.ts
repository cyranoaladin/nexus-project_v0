import { GET, POST } from '@/app/api/admin/test-email/route';
import { getServerSession } from 'next-auth';
import { sendWelcomeEmail, testEmailConfiguration } from '@/lib/email-service';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/lib/email-service', () => ({
  sendWelcomeEmail: jest.fn(),
  testEmailConfiguration: jest.fn(),
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('admin test email', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks non admin/assistant', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ action: 'test_config' }));

    expect(response.status).toBe(401);
  });

  it('returns config status on GET', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.configuration).toBeDefined();
  });

  it('tests SMTP config via POST', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (testEmailConfiguration as jest.Mock).mockResolvedValue({ success: true });

    const response = await POST(makeRequest({ action: 'test_config' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(testEmailConfiguration).toHaveBeenCalled();
  });

  it('requires testEmail for send_test', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest({ action: 'send_test' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('sends test email', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest({ action: 'send_test', testEmail: 'a@test.com' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(sendWelcomeEmail).toHaveBeenCalled();
  });
});
