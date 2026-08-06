import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

describe('Next standalone environment exclusion', () => {
  it('excludes every real .env file from output file tracing', () => {
    const configUrl = pathToFileURL(path.join(process.cwd(), 'next.config.mjs')).href;
    const output = execFileSync(process.execPath, [
      '--input-type=module',
      '--eval',
      `import config from ${JSON.stringify(configUrl)}; process.stdout.write(JSON.stringify(config.outputFileTracingExcludes));`,
    ], { encoding: 'utf8' });

    const exclusions = JSON.parse(output) as Record<string, string[]>;
    expect(exclusions['*']).toEqual(expect.arrayContaining(['.env', '.env.*']));
  });
});
