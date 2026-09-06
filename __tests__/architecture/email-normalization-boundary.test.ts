import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const consumers = [
  'lib/families/create-family.ts',
  'app/api/assistante/coaches/manage/route.ts',
  'app/api/assistante/coaches/manage/[id]/route.ts',
  'app/api/assistante/activate-student/route.ts',
  'app/api/auth/reset-password/route.ts',
  'app/api/stages/[stageSlug]/inscrire/route.ts',
  'app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts',
  'app/api/reservation/verify/route.ts',
  'lib/auth/parent-activation.ts',
  'lib/bilans/saisie-papier/test-account-filter.ts',
  'lib/crm/contact-leads.ts',
  'lib/email/outbox.ts',
  'lib/email-service.ts',
  'lib/services/student-activation.service.ts',
  'lib/stages/inscription-schema.ts',
  'lib/validation/common.ts',
  'scripts/create-stmg-students.ts',
  'scripts/seed-nsi-pratique-students.ts',
] as const;

describe('canonical email normalization boundary', () => {
  it.each(consumers)('%s delegates normalization to user-email', (relativePath) => {
    const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
    expect(source).toMatch(/normalizeUserEmail|normalizeParentEmail/);
    expect(source).not.toMatch(/(?:email|input\.to|data\.\w*Email|value \?\? '')\.trim\(\)(?:\.normalize\(['"]NFC['"]\))?\.toLowerCase\(\)/i);
  });

  it('has no second inline email-normalization implementation in application code', () => {
    const trackedSources = execFileSync('git', [
      'ls-files',
      'app/**/*.ts', 'app/**/*.tsx',
      'lib/**/*.ts', 'lib/**/*.tsx',
      'scripts/**/*.ts', 'scripts/**/*.tsx',
    ], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

    const inlineNormalization = [
      /\b\w*email\w*\.trim\(\)(?:\.normalize\([^)]*\))?\.toLowerCase\(\)/i,
      /\b\w*email\w*\.normalize\([^)]*\)\.toLowerCase\(\)/i,
      /\.email\([^)]*\)\.toLowerCase\(\)/i,
    ];

    const violations = trackedSources.filter((relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), 'utf8');
      return inlineNormalization.some((pattern) => pattern.test(source));
    });

    expect(violations).toEqual([]);
  });
});
