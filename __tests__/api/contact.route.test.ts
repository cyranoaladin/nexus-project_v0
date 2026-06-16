import { POST } from '@/app/api/contact/route';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';

jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true, skipped: false }),
}));

const mockCreate = prisma.contactLead.create as jest.Mock;
const mockSendMail = sendMail as jest.Mock;

function makeRequest(body: any) {
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('contact route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({
      id: 'lead_123',
      name: 'Alex Parent',
      email: 'alex.parent@example.com',
      phone: '+21699192829',
      profile: 'Candidat libre',
      interest: 'Terminale',
      urgency: null,
      source: 'home-final',
      status: 'NEW',
      notes: null,
      createdAt: new Date('2026-06-13T09:00:00.000Z'),
      updatedAt: new Date('2026-06-13T09:00:00.000Z'),
    });
    mockSendMail.mockResolvedValue({ ok: true, skipped: false });
  });

  it('returns 400 on missing required fields', async () => {
    const res = await POST(makeRequest({ name: '', email: '' }));
    const json = await (res as any).json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('missing_required');
  });

  it('returns 400 on invalid email', async () => {
    const res = await POST(makeRequest({ name: 'Alex Parent', email: 'not-an-email' }));
    const json = await (res as any).json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid_payload');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('stores a CRM lead and sends an internal notification on valid payload', async () => {
    const res = await POST(makeRequest({
      name: ' Alex Parent ',
      email: ' ALEX.PARENT@EXAMPLE.COM ',
      phone: ' +216 99 192 829 ',
      profile: 'Candidat libre',
      interest: 'Terminale',
      source: 'home-final',
    }));

    const json = await (res as any).json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, leadId: 'lead_123' });
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: 'Alex Parent',
        email: 'alex.parent@example.com',
        phone: '+216 99 192 829',
        profile: 'Candidat libre',
        interest: 'Terminale',
        urgency: null,
        source: 'home-final',
        status: 'NEW',
        notes: null,
      },
    });
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'contact@nexusreussite.academy',
      subject: expect.stringContaining('Nouveau prospect'),
      replyTo: 'alex.parent@example.com',
    }));
  });

  it('keeps the lead captured when internal email notification fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));

    const res = await POST(makeRequest({
      name: 'Alex Parent',
      email: 'alex.parent@example.com',
      phone: '+21699192829',
      profile: 'Scolarisé',
      interest: 'Première',
      source: 'selector',
    }));

    const json = await (res as any).json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, leadId: 'lead_123' });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the lead cannot be persisted', async () => {
    mockCreate.mockRejectedValueOnce(new Error('database unavailable'));

    const res = await POST(makeRequest({
      name: 'Alex Parent',
      email: 'alex.parent@example.com',
    }));

    const json = await (res as any).json();
    expect(res.status).toBe(500);
    expect(json.error).toBe('lead_capture_failed');
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
