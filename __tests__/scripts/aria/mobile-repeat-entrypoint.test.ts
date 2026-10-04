import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function run(project: string, failFirst = false) {
  const root = mkdtempSync(join(tmpdir(), 'nexus-synthetic-repeat-'));
  try {
    const bin = join(root, 'bin'); mkdirSync(bin);
    const log = join(root, 'commands');
    const credentials = join(root, 'synthetic-manifest'); writeFileSync(credentials, '{}');
    writeFileSync(join(bin, 'curl'), '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    writeFileSync(join(bin, 'npx'), '#!/bin/sh\nprintf "%s|%s\\n" "$PLAYWRIGHT_PROJECT" "$*" >> "$SYNTHETIC_COMMAND_LOG"\nif [ "$SYNTHETIC_FAIL_FIRST" = "1" ]; then exit 1; fi\n', { mode: 0o700 });
    const result = spawnSync('bash', [resolve('scripts/playwright-entrypoint.sh')], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, BASE_URL: 'http://synthetic.test',
        PLAYWRIGHT_CONFIG: 'playwright.aria.config.ts', PLAYWRIGHT_PROJECT: project,
        E2E_CREDENTIALS_PATH: credentials, SYNTHETIC_COMMAND_LOG: log,
        SYNTHETIC_FAIL_FIRST: failFirst ? '1' : '0' }, encoding: 'utf8',
    });
    return { status: result.status, commands: readFileSync(log, 'utf8').trim().split('\n') };
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('runs the complete mobile matrix before twenty serial E019 executions with no retries', () => {
  expect(run('aria-mobile')).toEqual({ status: 0, commands: [
    'aria-mobile|playwright test --config playwright.aria.config.ts --project aria-mobile',
    'aria-mobile-repeat20|playwright test --config playwright.aria.config.ts --project aria-mobile visual-a11y.spec.ts --grep ^E019  --repeat-each=20 --workers=1 --retries=0',
  ] });
});
test('does not mask a failed complete campaign by running the repetition', () => {
  const result = run('aria-mobile', true);
  expect(result.status).toBe(1);
  expect(result.commands).toHaveLength(1);
});
test('keeps the desktop lane unchanged', () => {
  expect(run('aria-desktop')).toEqual({ status: 0, commands: ['aria-desktop|playwright test --config playwright.aria.config.ts --project aria-desktop'] });
});
