import fs from 'fs';
import path from 'path';

const routeFiles = [
  ['app/api/bilan-gratuit/route.ts', 'guardSensitiveRateLimit'],
  ['app/api/stages/[stageSlug]/inscrire/route.ts', 'guardSensitiveRateLimit'],
  ['app/api/assessments/submit/route.ts', 'guardSensitiveRateLimit'],
  ['app/api/contact/route.ts', 'guardSensitiveRateLimit'],
  ['app/api/auth/reset-password/route.ts', 'guardSensitiveRateLimit'],
] as const;

describe('public anti-abuse route coverage', () => {
  it.each(routeFiles)('%s uses the expected async public rate-limit guard', (file, guard) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    expect(source).toContain(guard);
  });
});
