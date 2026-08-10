import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const consumers = [
  'app/api/assistante/students/route.ts',
  'app/api/reservation/verify/route.ts',
  'lib/auth/parent-activation.ts',
  'lib/bilans/saisie-papier/test-account-filter.ts',
  'lib/crm/contact-leads.ts',
  'lib/diagnostics/candidat-libre/student-provisioning.server.ts',
  'lib/email/outbox.ts',
  'scripts/create-stmg-students.ts',
] as const;

describe('canonical email normalization boundary', () => {
  it.each(consumers)('%s delegates normalization to user-email', (relativePath) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
    expect(source).toMatch(/normalizeUserEmail|normalizeParentEmail/);
    expect(source).not.toMatch(/(?:email|input\.to|data\.\w*Email|value \?\? '')\.trim\(\)(?:\.normalize\(['"]NFC['"]\))?\.toLowerCase\(\)/i);
  });
});
