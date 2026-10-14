import * as fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadBootstrapManifest, fingerprintOfBootstrapManifest } from '@/lib/core-v2/accounts/bootstrap-manifest';

let directory: string;
const body = { finalSha: 'a'.repeat(40), databaseIdentity: '68f7f918-36ec-4261-a5e4-4c1f986164c7',
  migrationHead: '0030_core_v2_invitation_authority', v1UserId: 'manifest-file-test-admin',
  expectedV1State: { role: 'ADMIN', activated: true, disabled: false, merged: false }, capability: 'ADMIN',
  nonce: 'manifest-file-test-nonce', expiresAt: '2027-01-01T00:00:00Z', reason: 'ISOLATED_TEST' };
const manifest = { ...body, fingerprint: fingerprintOfBootstrapManifest(body as never) };
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-manifest-')); fs.chmodSync(directory, 0o700); });
afterEach(() => { jest.dontMock('node:fs'); jest.restoreAllMocks(); fs.rmSync(directory, { recursive: true }); });
function write(name = 'manifest.json', mode = 0o400, value: unknown = manifest) {
  const file = path.join(directory, name); fs.writeFileSync(file, JSON.stringify(value), { mode }); fs.chmodSync(file, mode); return file;
}
test('a regular 0400 manifest is read from the descriptor that was checked', () => {
  const file = write();
  const replacementBody = { ...body, reason: 'REPLACEMENT_TEST' };
  const replacement = write('replacement.json', 0o400, { ...replacementBody, fingerprint: fingerprintOfBootstrapManifest(replacementBody as never) });
  const read = fs.readFileSync;
  jest.doMock('node:fs', () => ({ ...jest.requireActual('node:fs'), readFileSync(input: fs.PathOrFileDescriptor, options: never) {
    if (input === file) { fs.unlinkSync(file); fs.symlinkSync(replacement, file); }
    return read(input, options);
  } }));
  jest.isolateModules(() => {
    const isolated = require('@/lib/core-v2/accounts/bootstrap-manifest') as typeof import('@/lib/core-v2/accounts/bootstrap-manifest');
    expect(isolated.loadBootstrapManifest(file)).toEqual(manifest);
  });
});
test('a symlink cannot substitute a manifest even when its target is 0400', () => {
  const original = write(); const link = path.join(directory, 'link.json'); fs.symlinkSync(original, link);
  expect(() => loadBootstrapManifest(link)).toThrow();
});
test.each([0o600, 0o440, 0o644])('mode %i is refused', mode => {
  expect(() => loadBootstrapManifest(write('manifest.json', mode))).toThrow('MANIFEST_PERMISSIONS');
});
test('an oversized manifest is refused before content parsing', () => {
  const file = path.join(directory, 'oversized.json'); fs.writeFileSync(file, ' '.repeat(32_768), { mode: 0o400 });
  expect(() => loadBootstrapManifest(file)).toThrow('MANIFEST_FILE_INVALID');
});
