import { importsOf, source, sourceFilesUnder } from './aria-boundary-helpers';

describe('H003 ARIA persistence boundary', () => {
  it('keeps direct Prisma imports outside routes, components, domain and transports', () => {
    const violations = sourceFilesUnder(
      'app/api/aria', 'components/aria', 'lib/aria/domain', 'lib/aria/transport',
    ).flatMap((file) => importsOf(file)
      .filter((specifier) => specifier === '@/lib/prisma' || specifier === '@prisma/client')
      .map((specifier) => `${file} -> ${specifier}`));
    expect(violations).toEqual([]);
  });

  it('does not write the legacy AriaMessage feedback field in runtime code', () => {
    const runtime = sourceFilesUnder('app/api/aria', 'lib/aria')
      .map((file) => source(file)).join('\n');
    expect(runtime).not.toMatch(/ariaMessage\.(?:create|update|upsert)[\s\S]{0,500}feedback\s*:/);
  });
});
