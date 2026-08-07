import fs from 'node:fs';
import path from 'node:path';

describe('A94 Bilan runtime real-DB CI boundary', () => {
  it('runs the renamed real-DB suite in a dedicated PostgreSQL job', () => {
    const root = process.cwd();
    const current = path.join(root, '__tests__', 'lib', 'bilan-runtime', 'bilan-schema.real.test.ts');
    const legacy = path.join(root, '__tests__', 'lib', 'bilan', 'bilan-schema.real.test.ts');
    const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

    expect(fs.existsSync(current)).toBe(true);
    expect(fs.existsSync(legacy)).toBe(false);
    expect(ci).toContain('bilan-runtime-real-db:');
    expect(ci).toContain("--testPathIgnorePatterns='/__tests__/lib/bilan-runtime/'");
    expect(ci).toContain('__tests__/lib/bilan-runtime/bilan-schema.real.test.ts');
  });

  it('gates the required ci-success check on bilan-runtime-real-db', () => {
    // A job existing in the workflow file does not make it required --
    // only jobs listed in ci-success's `needs:` (and re-checked in its own
    // status-check step) can actually block a merge. This job was defined
    // but never wired into either, so it could fail without ci-success
    // (the check the branch ruleset actually requires) ever noticing.
    const root = process.cwd();
    const ci = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
    const ciSuccessJob = ci.slice(ci.indexOf('  ci-success:'), ci.indexOf('\n  # =', ci.indexOf('  ci-success:')));

    expect(ciSuccessJob).toMatch(/needs:[\s\S]*?- bilan-runtime-real-db/);
    expect(ciSuccessJob).toContain('bilan-runtime-real-db:${{ needs.bilan-runtime-real-db.result }}');
  });
});
