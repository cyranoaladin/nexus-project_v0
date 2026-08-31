import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { importsOf, source, sourceFilesUnder } from './aria-boundary-helpers';

interface WorkflowStep {
  readonly name?: string;
  readonly run?: string;
  readonly env?: Readonly<Record<string, unknown>>;
}

interface WorkflowDocument {
  readonly jobs: Readonly<Record<string, Readonly<{ steps?: readonly WorkflowStep[] }>>>;
}

describe('ARIA canonical application boundary', () => {
  it('H001 keeps routes and components away from RAG, model, prompt, Prisma and resource storage internals', () => {
    const violations = sourceFilesUnder('app/api/aria', 'components/aria').flatMap((file) =>
      importsOf(file)
        .filter((specifier) => [
          '/aria/rag', '/aria/gateway', '/aria/prompt', '/aria/core',
          '/aria/infrastructure/', '/lib/prisma', '/aria/resources',
        ].some((fragment) => specifier.includes(fragment)))
        .map((specifier) => `${file} -> ${specifier}`));
    expect(violations).toEqual([]);
  });

  it('allows the chat route to compose only the public conversation facade and transport adapters', () => {
    const imports = importsOf('app/api/aria/chat/route.ts');
    expect(imports).toContain('@/lib/aria/application/conversation/public');
    expect(imports).not.toContain('@/lib/aria/core');
  });

  it('makes both transports consume the public conversation use-case facade', () => {
    for (const file of ['lib/aria/transport/json.ts', 'lib/aria/transport/sse.ts']) {
      expect(importsOf(file)).toContain('../application/conversation/public');
      expect(importsOf(file)).not.toContain('../core');
    }
    expect(existsSync(resolve(process.cwd(), 'lib/aria/core.ts'))).toBe(false);
  });

  it('does not expose test-only or non-canonical runtime compatibility APIs', () => {
    const forbiddenByFile = new Map<string, readonly string[]>([
      ['lib/aria/infrastructure/model/gateway.ts', [
        'ARIA_DEFAULT_TIMEOUT_MS',
        'getAriaDefaultModel',
        'callChatCompletion',
        'readonly model?: string',
      ]],
      ['lib/aria/infrastructure/jobs/recovery-scheduler.ts', [
        'kickAriaTurnRecoveryDrain',
        'stopAriaTurnRecoveryScheduler',
      ]],
      ['lib/aria/application/conversation/build-prompt.ts', ['ARIA_MAX_MESSAGE_LENGTH']],
      ['lib/aria/resources.ts', [
        'listResourcesForStudentCourses',
        'verifyResourceOnDisk',
        'ARIA_RESOURCE_REGISTRY_VERSION',
      ]],
      ['lib/aria/curriculum.ts', [
        'SUBJECT_CANONICAL_LABELS',
        'getSubjectDisplayName',
        'getCourseDisplayName',
        'listSupportedAriaCourses',
      ]],
      ['scripts/aria/backfill-feedback-profile.ts', [
        'function main',
        'process.argv',
        'require.main',
      ]],
      ['scripts/aria/run-backfills.ts', [
        'export { assertDisposableAriaBackfillTarget }',
      ]],
    ]);

    const violations = [...forbiddenByFile].flatMap(([file, symbols]) =>
      symbols.filter((symbol) => source(file).includes(symbol)).map((symbol) => `${file}:${symbol}`));

    expect(violations).toEqual([]);
  });

  it('starts every production-mode CI server with migrated Turn recovery enabled', () => {
    const workflow = parseYaml(source('.github/workflows/ci.yml')) as WorkflowDocument;
    for (const [jobName, startupName] of [
      ['e2e', 'Start Next.js server in background'],
      ['e2e-auth', 'Start Next.js server in background (worker bilan actif)'],
      ['build', 'Smoke test standalone server'],
    ] as const) {
      const steps = workflow.jobs[jobName]?.steps ?? [];
      const startupIndex = steps.findIndex(({ name }) => name === startupName);
      const migrationIndex = steps.findIndex(({ run }) => run?.includes('prisma migrate deploy'));
      expect(startupIndex).toBeGreaterThanOrEqual(0);
      expect(migrationIndex).toBeGreaterThanOrEqual(0);
      expect(migrationIndex).toBeLessThan(startupIndex);
      expect(steps[startupIndex]?.env?.ARIA_TURN_RECOVERY_WORKER_ENABLED).toBe('true');
    }
  });
});
