import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('S4 durable email architecture', () => {
  test.each([
    'app/api/bilan-gratuit/route.ts',
    'app/api/auth/resend-activation/route.ts',
    'app/api/parent/children/route.ts',
    'app/api/auth/reset-password/route.ts',
  ])('%s persists an intent instead of sending SMTP directly', (path) => {
    expect(source(path)).toContain('enqueueEmailIntent');
    expect(source(path)).not.toMatch(/\bsendMail\s*\(/);
  });

  test('the worker is scheduled and does not claim exactly-once SMTP delivery', () => {
    expect(source('instrumentation.ts')).toContain('startEmailOutboxScheduler');
    const combined = [
      source('lib/email/outbox.ts'), source('lib/email/outbox-worker.ts'),
      source('lib/email/outbox-scheduler.ts'),
    ].join('\n');
    expect(combined).toContain('FOR UPDATE SKIP LOCKED');
    expect(combined).toContain('AMBIGUOUS');
    expect(combined).not.toMatch(/exactly[- ]once/i);
  });
});
