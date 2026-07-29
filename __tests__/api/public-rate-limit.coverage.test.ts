import fs from 'fs';
import path from 'path';

const routeFiles = [
  'app/api/bilan-gratuit/route.ts',
  'app/api/bilan-gratuit/v1/requests/route.ts',
  'app/api/auth/bilan-magic/request/route.ts',
  'app/api/stages/[stageSlug]/inscrire/route.ts',
  'app/api/assessments/submit/route.ts',
  'app/api/contact/route.ts',
  'app/api/auth/reset-password/route.ts',
];

describe('public anti-abuse route coverage', () => {
  it.each(routeFiles)('%s uses the async public rate-limit guard', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(source).toContain('guardRateLimitAsync');
  });
});

describe('canonical bilan fail-closed rate-limit coverage', () => {
  it.each([
    'app/api/bilan-gratuit/route.ts',
    'app/api/bilan-gratuit/v1/requests/route.ts',
    'app/api/auth/bilan-magic/request/route.ts',
  ])('%s explicitly requires the distributed limiter', (file) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(source).toContain('requireDistributed: true');
  });

  it('keeps the future canonical submit endpoint in the release gate', () => {
    const plan = fs.readFileSync(
      path.join(
        process.cwd(),
        'docs/superpowers/plans/2026-07-29-bilan-gratuit-canonical-go-live.md',
      ),
      'utf8',
    );
    expect(plan).toContain(
      'app/api/bilan-gratuit/v1/requests/current/submit/route.ts',
    );
    expect(plan).toContain('Use it on intake, magic-link request and submit endpoints.');
  });
});
