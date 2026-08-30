import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { importsOf, sourceFilesUnder } from './aria-boundary-helpers';

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
});
