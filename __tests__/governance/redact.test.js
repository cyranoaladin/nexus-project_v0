const fs = require('fs');
const os = require('os');
const path = require('path');

describe('snapshot redaction and safe writes', () => {
  let redact;
  let tmpDir;

  beforeAll(async () => {
    redact = await import('../../scripts/github/lib/redact.mjs');
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-redact-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('drops key/value pairs whose key looks like a secret', () => {
    const redacted = redact.redactDeep({
      apiToken: 'abc123',
      nested: { password: 'hunter2', ok: 'fine' },
      secretNames: ['SOME_SECRET_NAME'],
    });
    expect(redacted.apiToken).toBe('[REDACTED-KEY]');
    expect(redacted.nested.password).toBe('[REDACTED-KEY]');
    expect(redacted.nested.ok).toBe('fine');
    // secretNames is an explicit allowlisted key: it holds names, never values.
    expect(redacted.secretNames).toEqual(['SOME_SECRET_NAME']);
  });

  test('redacts credential-shaped scalar values even under an innocuous-looking key', () => {
    const redacted = redact.redactDeep({ headerLike: 'Bearer abc.def.ghi', someField: 'ghp_abcdefgh' });
    expect(redacted.headerLike).toBe('[REDACTED-CREDENTIAL-VALUE]');
    expect(redacted.someField).toBe('[REDACTED-CREDENTIAL-VALUE]');
  });

  test('a key ending in Token/Secret/Password/Authorization is dropped regardless of its value', () => {
    const redacted = redact.redactDeep({ apiToken: 'not-credential-shaped-at-all' });
    expect(redacted.apiToken).toBe('[REDACTED-KEY]');
  });

  test('writeSnapshotFile creates the file at 0600 and its directory at 0700', () => {
    const target = path.join(tmpDir, 'nested', 'snapshot.json');
    redact.writeSnapshotFile(target, '{}\n');
    const fileMode = fs.statSync(target).mode & 0o777;
    const dirMode = fs.statSync(path.dirname(target)).mode & 0o777;
    expect(fileMode).toBe(0o600);
    expect(dirMode).toBe(0o700);
  });

  test('refuses to write through a symlinked target path', () => {
    const real = path.join(tmpDir, 'real.json');
    const link = path.join(tmpDir, 'link.json');
    fs.writeFileSync(real, '{}');
    fs.symlinkSync(real, link);
    expect(() => redact.writeSnapshotFile(link, '{"x":1}\n')).toThrow(/SNAPSHOT_SYMLINK_REFUSED/);
  });

  test('write is atomic: no partial file is ever visible at the final path', () => {
    const target = path.join(tmpDir, 'atomic.json');
    redact.writeSnapshotFile(target, '{"a":1}\n');
    const filesInDir = fs.readdirSync(tmpDir);
    expect(filesInDir.filter((f) => f.includes('.tmp-'))).toEqual([]);
    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":1}\n');
  });
});
