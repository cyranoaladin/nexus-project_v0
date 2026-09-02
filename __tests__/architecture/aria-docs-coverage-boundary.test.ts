import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { source } from './aria-boundary-helpers';

const REQUIRED_RELEASE_SCRIPTS = [
  'aria:test-plan:check',
  'test:aria:coverage',
  'aria:coverage:check',
  'test:aria:e2e:desktop',
  'test:aria:e2e:mobile',
  'test:aria:a11y',
  'typecheck:aria-scripts',
  'aria:security',
  'aria:manifest:check',
  'aria:manifest:runtime-check',
  'aria:performance:check',
  'test:aria:migrations',
  'test:aria:backfills',
  'aria:artifact:check',
  'aria:smoke:production-artifact',
] as const;

describe('ARIA repository architecture evidence', () => {
  it('H008 versions the V2 runtime, lifecycle, authorization, privacy, RAG and rollout contracts', () => {
    const architecture = source('docs/architecture/ARIA_V1.md');
    for (const evidence of [
      'Frontières de modules', 'Matrice API/route', 'stateDiagram',
      'idempotence', 'concurrence', 'Retrieval', 'erreurs',
      'contexte autorisé', 'Privacy', 'Resource Registry', 'Migration', 'ARIA-C',
    ]) expect(architecture).toMatch(new RegExp(evidence, 'i'));
  });

  it('keeps representation and product capability coverage separate and non-absolute', () => {
    const matrix = source('docs/architecture/ARIA_PERSONAL_LEARNING_OS_DATA_MODEL.md');
    expect(matrix).toMatch(/ACADEMIC_MAP_REPRESENTATION_COVERAGE/);
    expect(matrix).toMatch(/ARIA_CAPABILITY_COVERAGE/);
    expect(matrix).toMatch(/CANDIDAT_LIBRE_COVERAGE=NOT_PROVEN/i);
    expect(matrix).not.toMatch(/ACADEMIC_MAP_SUPPORTED_PROFILES\s*=\s*100%/);
  });

  it('exposes every executable C16 qualification gate promised by the versioned plan', () => {
    const packageJson = JSON.parse(source('package.json')) as {
      scripts?: Record<string, string>;
    };
    for (const script of REQUIRED_RELEASE_SCRIPTS) {
      expect(packageJson.scripts?.[script]).toEqual(expect.any(String));
      expect(packageJson.scripts?.[script]).not.toHaveLength(0);
    }

    expect(source('jest.aria.coverage.config.js')).toMatch(/collectCoverageFrom/);
    expect(packageJson.scripts?.['test:aria:coverage']).toMatch(/generate-coverage/);
    const coverageProducer = source('scripts/aria/generate-coverage.ts');
    expect(coverageProducer).toMatch(/jest\.aria\.coverage\.config\.js/);
    expect(coverageProducer).toMatch(/run-disposable-db-suite\.sh[\s\S]*database/);
    expect(coverageProducer).toMatch(/run-disposable-db-suite\.sh[\s\S]*concurrency/);
    expect(coverageProducer).toMatch(/coverage-final\.json/);
    expect(coverageProducer).toMatch(/git[\s\S]*rev-parse[\s\S]*HEAD/);
    expect(coverageProducer).toMatch(/lib\/aria/);
    expect(coverageProducer).toMatch(/app\/api\/aria/);
    expect(coverageProducer).toMatch(/components\/aria/);
    expect(coverageProducer).toMatch(/scripts\/aria/);
    expect(coverageProducer).toMatch(/laneCoverage\.filter/);
    const scriptTypecheck = source('tsconfig.aria-scripts.json');
    expect(scriptTypecheck).toMatch(/scripts\/aria/);
    expect(scriptTypecheck).toMatch(/scripts\/e2e/);
    expect(source('scripts/aria/check-test-traceability.ts')).toMatch(
      /CRITICAL_REQUIREMENTS_WITHOUT_TEST_EVIDENCE/,
    );
    expect(source('scripts/aria/check-coverage.ts')).toMatch(/95/);
  });

  it('keeps M2 legacy schema debt explicitly open with operational closure guards', () => {
    const ledger = source('docs/stack-closure/ZERO_DEBT_LEDGER.json');
    expect(ledger).toMatch(/"ARIA_LEGACY_SCHEMA_DEBT"/);
    expect(ledger).toMatch(/"status": "OPEN"/);
    expect(ledger).toMatch(/verify-contract-readiness\.ts/);
    expect(ledger).toMatch(/requiredSoak/);
    expect(ledger).toMatch(/legacy writers/i);
  });

  it('documents the implemented descriptor-secure immutable resource snapshot', () => {
    const evidence = [
      source('docs/architecture/ARIA_V1.md'),
      source('docs/superpowers/plans/2026-08-30-aria-b-conversation-foundation.md'),
    ].join('\n');
    expect(evidence).not.toMatch(/openat2/);
    expect(evidence).toMatch(/O_NOFOLLOW/);
    expect(evidence).toMatch(/snapshot immuable/i);
    expect(evidence).toMatch(/inode/i);

    const implementation = source('lib/aria/infrastructure/resources/secure-open-linux.ts');
    expect(implementation).toMatch(/O_NOFOLLOW/);
    expect(implementation).toMatch(/sameInode/);
    expect(implementation).toMatch(/Readable\.from\(\[snapshot\.bytes\]\)/);
  });

  it('runs ARIA browser qualification against the real disposable backend and fixture services', () => {
    for (const path of [
      'playwright.aria.config.ts',
      'scripts/aria/run-e2e-suite.sh',
      'scripts/e2e/aria-fixture-provider.ts',
      'e2e/aria/conversation.spec.ts',
      'e2e/aria/visual-a11y.spec.ts',
      'data/aria/evaluation/conversation-e2e.v1.json',
    ]) expect(existsSync(resolve(process.cwd(), path))).toBe(true);

    const config = source('playwright.aria.config.ts');
    expect(config).toMatch(/retries:\s*0/);
    expect(config).toMatch(/forbidOnly:\s*true/);
    expect(config).toMatch(/aria-desktop/);
    expect(config).toMatch(/aria-mobile/);
    expect(config).toMatch(/aria-a11y/);

    const fixtureProvider = source('scripts/e2e/aria-fixture-provider.ts');
    expect(fixtureProvider).toMatch(/E2E_DISPOSABLE_STACK/);
    expect(fixtureProvider).toMatch(/\/v1\/chat\/completions/);
    expect(fixtureProvider).toMatch(/\/search\/v2/);
    expect(fixtureProvider).toMatch(/x-nexus-identity/i);

    const browserTests = [
      source('e2e/aria/conversation.spec.ts'),
      source('e2e/aria/visual-a11y.spec.ts'),
    ].join('\n');
    expect(browserTests).not.toMatch(/page\.route\s*\(/);
    expect(browserTests).not.toMatch(/test\.(?:skip|todo|only)\s*\(/);
    expect(browserTests).toMatch(/E2E_ARIA_COMPLETE_CONVERSATION_FLOW/);
    expect(browserTests).toMatch(/ARIA_NO_BROWSER_ERRORS/);
    expect(browserTests).toMatch(/ARIA_VISUAL_VIEWPORT_MATRIX/);
    expect(browserTests).toMatch(/ARIA_A11Y_MATRIX/);
  });
});
