import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  extractQualificationCasesFromJest,
  extractQualificationCasesFromPlaywright,
  type AriaQualificationLane,
} from './qualification-evidence';

export const ARIA_QUALIFICATION_LANES = Object.freeze([
  { id: 'jest-aria-unit', lane: 'unit' },
  { id: 'jest-aria-api', lane: 'api' },
  { id: 'jest-aria-integration', lane: 'integration' },
  { id: 'jest-aria-sse', lane: 'unit' },
  { id: 'jest-aria-architecture', lane: 'architecture' },
  { id: 'jest-aria-db', lane: 'database' },
  { id: 'jest-aria-concurrency', lane: 'concurrency' },
] as const);

interface NativeView {
  readonly schemaVersion: 1;
  readonly headSha: string;
  readonly proofKind: 'DERIVED_FROM_VERIFIED_NATIVE_REPORTS';
  readonly qualificationScope: string;
  readonly tree: string;
  readonly sourceFingerprint: string;
  readonly runIdentity: unknown;
  readonly launchPlanSha256: string;
  readonly sources: readonly unknown[];
  readonly assertions: readonly {
    path: string; title: string; status: string; qualificationLane: AriaQualificationLane;
  }[];
}

function readNativeView(repositoryRoot: string, preset: 'jest' | 'playwright'): NativeView {
  // This subprocess reads reports and producer companions. It executes no tests
  // or database harnesses and downloads no packages.
  try {
    return JSON.parse(execFileSync(process.execPath, [
      resolve(repositoryRoot, 'scripts/testing/verified-lane-view.mjs'), preset,
    ], { cwd: repositoryRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'] })) as NativeView;
  } catch {
    throw new Error('ARIA_NATIVE_EVIDENCE_REFUSED');
  }
}

export function readVerifiedAriaTestEvidence(repositoryRoot: string) {
  const { assertions, ...proof } = readNativeView(repositoryRoot, 'jest');
  const cases = assertions.flatMap((assertion) => extractQualificationCasesFromJest(
    assertion.qualificationLane as Exclude<AriaQualificationLane, 'e2e' | 'smoke'>,
    { testResults: [{ name: resolve(repositoryRoot, assertion.path),
      assertionResults: [{ fullName: assertion.title, status: assertion.status }] }] },
  ));
  return Object.freeze({ ...proof, cases: Object.freeze(cases) });
}

export function readVerifiedAriaBrowserEvidence(repositoryRoot: string) {
  const { assertions, ...proof } = readNativeView(repositoryRoot, 'playwright');
  const cases = assertions.flatMap((assertion) => extractQualificationCasesFromPlaywright({
    suites: [{ file: assertion.path, specs: [{ title: assertion.title,
      tests: [{ results: [{ status: assertion.status }] }] }] }],
  }, assertion.qualificationLane as 'e2e' | 'smoke'));
  return Object.freeze({ ...proof, cases: Object.freeze(cases) });
}

export function assertSavedAriaTestEvidence(repositoryRoot: string) {
  const verified = readVerifiedAriaTestEvidence(repositoryRoot);
  const saved = JSON.parse(readFileSync(resolve(
    repositoryRoot, '.artifacts/aria/qualification/jest-evidence.json',
  ), 'utf8')) as unknown;
  if (JSON.stringify(saved) !== JSON.stringify(verified)) {
    throw new Error('ARIA_DERIVED_EVIDENCE_MISMATCH');
  }
  return verified;
}

export function generateAriaTestEvidence(
  repositoryRoot: string,
  dependencies: Readonly<{ write?: (value: string) => void }> = {},
) {
  const verified = readVerifiedAriaTestEvidence(repositoryRoot);
  const artifactRoot = resolve(repositoryRoot, '.artifacts/aria/qualification');
  mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
  writeFileSync(resolve(artifactRoot, 'jest-evidence.json'), `${JSON.stringify(verified, null, 2)}\n`, {
    flag: 'wx', mode: 0o600,
  });
  const write = dependencies.write ?? ((value: string) => process.stdout.write(value));
  write(`ARIA_JEST_EVIDENCE_HEAD=${verified.headSha}\nARIA_JEST_EVIDENCE_CASES=${verified.cases.length}\n`);
  return verified;
}

if (require.main === module) generateAriaTestEvidence(process.cwd());
