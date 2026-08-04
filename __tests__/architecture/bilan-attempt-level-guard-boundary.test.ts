import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = resolve(root, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe('canonical attempt creation boundary', () => {
  test('all application entry points delegate to the guarded canonical service', () => {
    const route = readFileSync('app/api/bilans/attempts/route.ts', 'utf8');
    const protocol = readFileSync('lib/bilans/passation/pilot-protocol.ts', 'utf8');
    const service = readFileSync('lib/bilans/api/create-attempt.ts', 'utf8');

    expect(route).toContain('createCreateAttemptHandler');
    expect(protocol).toContain("fetcher('/api/bilans/attempts'");
    expect(service).toContain('assertStudentPackLevel');
    expect(service.indexOf('const gradeLevel = assertStudentPackLevel')).toBeLessThan(
      service.indexOf('const result = await executeIdempotently'),
    );

    const directWrites = [...sourceFiles(resolve('app')), ...sourceFiles(resolve('lib'))]
      .filter((path) => /canonicalAssessmentAttempt\s*\.\s*(?:create|createMany|upsert)\s*\(/.test(
        readFileSync(path, 'utf8'),
      ));
    expect(directWrites).toEqual([]);
  });
});
