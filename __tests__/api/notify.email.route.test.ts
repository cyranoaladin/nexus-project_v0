/**
 * Notify Email API — Complete Test Suite
 *
 * Tests: POST /api/notify/email
 *
 * Source: app/api/notify/email/route.ts
 */

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ skipped: false }),
}));

jest.mock('@/lib/email/templates', () => ({
  bilanAcknowledgement: jest.fn().mockReturnValue({
    subject: 'Accusé de réception',
    html: '<p>Merci</p>',
    text: 'Merci',
  }),
  internalNotification: jest.fn().mockReturnValue({
    subject: 'Notification interne',
    html: '<p>Event</p>',
    text: 'Event',
  }),
}));

import { POST } from '@/app/api/notify/email/route';
import { sendMail } from '@/lib/email/mailer';
import { NextRequest } from 'next/server';

const mockSendMail = sendMail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/notify/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3000',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notify/email — bilan_ack', () => {
  it('should send bilan acknowledgement email', async () => {
    const res = await POST(makeRequest({
      type: 'bilan_ack',
      to: 'parent@test.com',
      parentName: 'Karim Ben Ali',
      studentName: 'Ahmed Ben Ali',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'parent@test.com' })
    );
  });

  it('should reject invalid email in bilan_ack', async () => {
    const res = await POST(makeRequest({
      type: 'bilan_ack',
      to: 'not-email',
      parentName: 'Karim',
      studentName: 'Ahmed',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.ok).toBe(false);
  });

  it('should reject missing parentName', async () => {
    const res = await POST(makeRequest({
      type: 'bilan_ack',
      to: 'parent@test.com',
      studentName: 'Ahmed',
    }));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/notify/email — internal', () => {
  it('should send internal notification', async () => {
    const res = await POST(makeRequest({
      type: 'internal',
      eventType: 'new_bilan_submitted',
      fields: { studentName: 'Ahmed', score: '65' },
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('should reject missing eventType', async () => {
    const res = await POST(makeRequest({
      type: 'internal',
      fields: { key: 'value' },
    }));

    expect(res.status).toBe(400);
  });
});

describe('POST /api/notify/email — validation', () => {
  it('should reject unknown type', async () => {
    const res = await POST(makeRequest({
      type: 'unknown_type',
      data: 'test',
    }));

    expect(res.status).toBe(400);
  });

  it('should return 500 when sendMail fails', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

    const res = await POST(makeRequest({
      type: 'bilan_ack',
      to: 'parent@test.com',
      parentName: 'Karim',
      studentName: 'Ahmed',
    }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
  });
});
