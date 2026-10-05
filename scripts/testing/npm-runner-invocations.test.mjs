import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverRunnerNpmScripts } from './npm-runner-invocations.mjs';
test('existing literal shell npm invocation discovery is preserved', () => {
  assert.deepEqual(discoverRunnerNpmScripts('npm run test:unit; npm run test:unit; npm run test:integration', 'shell'), ['test:unit', 'test:integration']);
});
test('a literal npm subprocess in a TypeScript wrapper reaches its test script', () => {
  assert.deepEqual(discoverRunnerNpmScripts("const result = spawnSync('npm', ['run', 'test:golden-family:real', '--', '--ci', '--json', '--silent'], { env });"), ['test:golden-family:real']);
});
test('a multiline literal execFile npm invocation is discovered', () => {
  assert.deepEqual(discoverRunnerNpmScripts('execFileSync("npm", [\n "run", "test:unit", "--", "--ci"\n]);'), ['test:unit']);
});
test('computed commands, comments, a different executable and restricted subprocesses cannot imply a full lane', () => {
  for (const source of ["spawnSync('npm', ['run', scriptName])", "// spawnSync('npm', ['run', 'test:fake'])", "spawnSync('other', ['run', 'test:fake'])", "spawnSync('npm', ['run', 'test:unit', '--', '--runTestsByPath', 'one.test.ts'])"]) {
    assert.deepEqual(discoverRunnerNpmScripts(source), []);
  }
});
