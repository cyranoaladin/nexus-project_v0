import { NextRequest } from 'next/server';

import { _resetStoreForTests } from '@/lib/rate-limit';
import { POST } from '@/app/api/notify/email/route';
import { queueCommittedEmail } from '@/lib/email/queue';

jest.mock('@/lib/email/queue', () => ({
  queueCommittedEmail: jest.fn().mockResolvedValue({ id: 'job-1' }),
}));

const mockSendMail = queueCommittedEmail as jest.Mock;

function makeRequest(body: Record<string, unknown>, ip = '198.51.100.60'): NextRequest {
  return new NextRequest('http://localhost:3000/api/notify/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notify/email — internal notification identity rate-limit', () => {
  beforeEach(() => {
    _resetStoreForTests();
    jest.clearAllMocks();
    delete process.env.RATE_LIMIT_DISABLE;
    delete process.env.REDIS_URL;
    process.env.MAIL_DISABLED = 'false';
  });

  afterEach(() => {
    delete process.env.MAIL_DISABLED;
  });

  it('rate-limits internal notifications by the fixed recipient identity, not by the caller-supplied eventType', async () => {
    // Same IP, a DIFFERENT eventType on every request. If eventType were used
    // as the identity (the bug), every request would land in its own bucket
    // and never hit the identity limit — only the much coarser IP limit would
    // ever apply, letting internal-notification abuse through. With a fixed
    // identity, the 6th request must be blocked (emailIdentity limit is 5).
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeRequest({
        type: 'internal',
        eventType: `event-${i}`,
        fields: { key: 'value' },
      }));
      expect(res.status).toBe(200);
    }

    const blocked = await POST(makeRequest({
      type: 'internal',
      eventType: 'event-yet-another',
      fields: { key: 'value' },
    }));
    expect(blocked.status).toBe(429);
    expect(mockSendMail).toHaveBeenCalledTimes(5);
  });
});
