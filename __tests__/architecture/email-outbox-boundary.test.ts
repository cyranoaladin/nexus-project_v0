import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('S4 durable email architecture', () => {
  test.each([
    // bilan-gratuit and parent/children no longer send any email at all
    // (Amendement 7, Task 4): a public submission or a parent add-child
    // action only ever creates a FamilyRequest, never a live account, so
    // there is nothing to activate yet. The durable-outbox boundary now
    // applies where the account is actually created -- inside
    // lib/families/create-family.ts's createFamily()/
    // addChildToExistingFamily(), reached only through the staff
    // conversion route.
    'app/api/auth/resend-activation/route.ts',
    'app/api/auth/reset-password/route.ts',
  ])('%s persists an intent instead of sending SMTP directly', (path) => {
    expect(source(path)).toContain('enqueueEmailIntent');
    expect(source(path)).not.toMatch(/\bsendMail\s*\(/);
  });

  test('createFamily()/addChildToExistingFamily() persist an intent instead of sending SMTP directly', () => {
    const createFamilySource = source('lib/families/create-family.ts');
    expect(createFamilySource).toContain('enqueueEmailIntent');
    expect(createFamilySource).not.toMatch(/\bsendMail\s*\(/);
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
