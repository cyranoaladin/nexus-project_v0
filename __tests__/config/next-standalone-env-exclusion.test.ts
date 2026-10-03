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
  it('excludes repository test artifacts while retaining application and native runtime files', () => {
    const forbidden = [
      '.artifacts/recovery/rag/synthetic.aria-rag-manifest',
      '.artifacts/recovery/e2e-env.json',
      '__tests__/fixtures/test.json', '__mocks__/provider.ts',
      'coverage/report.json', 'e2e/.credentials.json',
      'playwright-report/auth/trace.zip', 'test-results/auth/screenshot.png',
    ];
    const required = [
      'node_modules/next/dist/server/async-storage/request-store.js',
      'node_modules/@napi-rs/canvas-linux-x64-gnu/skia.linux-x64-gnu.node',
      'node_modules/pdfjs-dist/legacy/build/pdf.mjs',
      'data/bilans/banks/manifest.json', 'programmes/resource.pdf',
    ];
    const configUrl = pathToFileURL(path.join(process.cwd(), 'next.config.mjs')).href;
    const output = execFileSync(process.execPath, ['--input-type=module', '--eval',
      `import config from ${JSON.stringify(configUrl)};
       import { createRequire } from 'node:module';
       const minimatch = createRequire(import.meta.url)('minimatch');
       const files = ${JSON.stringify([...forbidden, ...required])};
       process.stdout.write(JSON.stringify(Object.fromEntries(files.map(file =>
         [file, config.outputFileTracingExcludes['*'].some(pattern => minimatch(file, pattern, { dot: true }))]))));`,
    ], { encoding: 'utf8' });
    const excluded = JSON.parse(output) as Record<string, boolean>;
    for (const file of forbidden) expect({ file, excluded: excluded[file] }).toEqual({ file, excluded: true });
    for (const file of required) expect({ file, excluded: excluded[file] }).toEqual({ file, excluded: false });
  });
});
