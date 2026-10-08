/** @jest-environment node */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

const script = resolve(__dirname, '../../scripts/release/encrypt-release-archive.mjs');
const root = resolve(__dirname, '../..');
let directory: string;
let home: string;
let publicKey: string;
function gpg(args: string[]) {
  return spawnSync('gpg', ['--no-options', '--homedir', home, '--batch', '--no-tty', ...args], { encoding: 'buffer' });
}
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'nexus-encryption-test-'));
  home = join(directory, 'gnupg');
  mkdirSync(home, { mode: 0o700 });
  const generated = gpg(['--pinentry-mode', 'loopback', '--passphrase', '', '--quick-generate-key', 'Nexus disposable test', 'rsa2048', 'encrypt', '1d']);
  expect(generated.status).toBe(0);
  publicKey = join(directory, 'recipient.asc');
  writeFileSync(publicKey, gpg(['--armor', '--export']).stdout);
}, 30000);
afterAll(() => {
  spawnSync('gpgconf', ['--homedir', home, '--kill', 'gpg-agent']);
  rmSync(directory, { recursive: true, force: true });
});

it('restores every archive byte only with the private recipient key and never emits plaintext', () => {
  const input = join(directory, 'bundle.tar.gz');
  const output = join(directory, 'bundle.tar.gz.gpg');
  const source = join(directory, 'source');
  mkdirSync(source);
  const sentinel = Buffer.from('synthetic framework key sentinel\0\xff\narchive fixture');
  writeFileSync(join(source, 'server-manifest'), sentinel);
  chmodSync(join(source, 'server-manifest'), 0o640);
  expect(spawnSync('tar', ['-czf', input, '-C', source, '.']).status).toBe(0);
  const bytes = readFileSync(input);
  const result = spawnSync('node', [script, input, publicKey, output], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  expect(result.stdout + result.stderr).not.toContain('synthetic framework');
  expect(readFileSync(output).includes(bytes)).toBe(false);
  const restored = gpg(['--decrypt', output]);
  expect(restored.status).toBe(0);
  expect(restored.stdout).toEqual(bytes);
  const restoredFile = join(directory, 'restored.tar.gz');
  writeFileSync(restoredFile, restored.stdout);
  const extracted = join(directory, 'restored');
  mkdirSync(extracted);
  expect(spawnSync('tar', ['-xzf', restoredFile, '-C', extracted]).status).toBe(0);
  expect(readFileSync(join(extracted, 'server-manifest'))).toEqual(sentinel);
  expect(statSync(join(extracted, 'server-manifest')).mode & 0o777).toBe(0o640);
  const stranger = join(directory, 'stranger');
  mkdirSync(stranger, { mode: 0o700 });
  expect(spawnSync('gpg', ['--no-options', '--homedir', stranger, '--batch', '--decrypt', output]).status).not.toBe(0);
  // Publishing ciphertext must never overwrite an already sealed release.
  const sealed = readFileSync(output);
  const again = spawnSync('node', [script, input, publicKey, output], { encoding: 'utf8' });
  expect(again.status).not.toBe(0);
  expect(readFileSync(output)).toEqual(sealed);
  const damaged = Buffer.from(sealed);
  damaged[damaged.length - 1] ^= 1;
  const tampered = join(directory, 'tampered.gpg');
  writeFileSync(tampered, damaged);
  expect(gpg(['--decrypt', tampered]).status).not.toBe(0);
});

it('fails closed for an invalid public recipient without a publishable output', () => {
  const key = join(directory, 'invalid.asc');
  const input = join(directory, 'invalid-recipient-input.tar.gz');
  const output = join(directory, 'invalid.gpg');
  writeFileSync(key, 'not a recipient');
  writeFileSync(input, 'independent archive fixture');
  const result = spawnSync('node', [script, input, key, output], { encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(readdirSync(directory)).not.toContain('invalid.gpg');
});

it.each(['ci.yml', 'preview-artifact.yml'])('%s publishes only encrypted runtime archives and public sidecars', (file) => {
  const workflow = yaml.load(readFileSync(join(root, '.github/workflows', file), 'utf8')) as {
    jobs: Record<string, { steps: Array<{ name?: string; run?: string; with?: { name?: string; path?: string } }> }>;
  };
  const steps = Object.values(workflow.jobs).flatMap(job => job.steps || []);
  const upload = steps.find(step => ['Upload build artifacts', 'Upload deployable Preview artifact'].includes(step.name || ''))!;
  expect(upload).toBeDefined();
  const paths = upload.with!.path!.trim().split('\n').map(path => path.trim());
  expect(paths.some(path => path.endsWith('.tar.gz.gpg'))).toBe(true);
  const expected = file === 'ci.yml'
    ? ['nexus-build.tar.gz.gpg', 'archive.sha256', 'ciphertext.sha256', 'release-manifest.json', 'runtime.cdx.json']
    : ['preview-standalone.tar.gz.gpg', 'preview-standalone.tar.gz.sha256', 'ciphertext.sha256', 'release-manifest.json', 'delivery-provenance.json'];
  expect(paths.map(path => path.split('/').at(-1)).sort()).toEqual(expected.sort());
  expect(paths.some(path => path.includes('.next/') || path.endsWith('.tar.gz'))).toBe(false);
  const encryption = steps.findIndex(step => step.run?.includes('scripts/release/encrypt-release-archive.mjs'));
  expect(encryption).toBeGreaterThan(-1);
  expect(encryption).toBeLessThan(steps.indexOf(upload));
});
