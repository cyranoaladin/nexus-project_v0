import { source, sourceFilesUnder } from './aria-boundary-helpers';

describe('ARIA LearningEvidence append-only boundary', () => {
  it('the evidence application layer never calls learningEvidence.update or .delete anywhere', () => {
    const violations = sourceFilesUnder('lib/aria/application/evidence')
      .flatMap((file) => {
        const text = source(file);
        const hits: string[] = [];
        if (/learningEvidence\.update\b/.test(text)) hits.push(`${file}: learningEvidence.update`);
        if (/learningEvidence\.delete\b/.test(text)) hits.push(`${file}: learningEvidence.delete`);
        if (/learningEvidence\.upsert\b/.test(text)) hits.push(`${file}: learningEvidence.upsert`);
        return hits;
      });
    expect(violations).toEqual([]);
  });

  it('the Prisma repository itself exposes no mutation path beyond create', () => {
    const text = source('lib/aria/infrastructure/prisma/learning-evidence-repository.ts');
    expect(text).not.toMatch(/\.update\(/);
    expect(text).not.toMatch(/\.delete\(/);
    expect(text).not.toMatch(/\.upsert\(/);
    expect(text).not.toMatch(/\.deleteMany\(/);
    expect(text).not.toMatch(/\.updateMany\(/);
  });

  it('the repository interface itself never declares an update or delete method', () => {
    const text = source('lib/aria/application/evidence/ports.ts');
    expect(text).not.toMatch(/\bupdate\s*\(/);
    expect(text).not.toMatch(/\bdelete\s*\(/);
    expect(text).not.toMatch(/\bupsert\s*\(/);
  });
});
