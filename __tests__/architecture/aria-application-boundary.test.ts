import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { importsOf, source, sourceFilesUnder } from './aria-boundary-helpers';

describe('H001 ARIA canonical application boundary', () => {
  it('keeps routes and components away from RAG, model, prompt, Prisma and resource storage internals', () => {
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
});
