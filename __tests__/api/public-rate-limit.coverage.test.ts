import fs from 'fs';
import path from 'path';

const routeFiles = [
  'app/api/bilan-gratuit/route.ts',
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
