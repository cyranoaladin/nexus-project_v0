/** @jest-environment node */

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readPrivateOpenRouterApiKey } from '@/lib/llm/openrouter/preflight-secret';

describe('private OpenRouter preflight key', () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(contents = 'synthetic-private-key\n') {
    const root = mkdtempSync(join(tmpdir(), 'nexus-openrouter-key-'));
    roots.push(root);
    const directory = join(root, 'nexus-secrets');
    mkdirSync(directory, { mode: 0o700 });
    const path = join(directory, 'openrouter-api-key');
    writeFileSync(path, contents, { mode: 0o600 });
    chmodSync(directory, 0o700);
    chmodSync(path, 0o600);
    return { root, directory, path };
  }

  it('reads one non-empty private line without exposing it', () => {
    const { path } = fixture();
    expect(readPrivateOpenRouterApiKey(path)).toBe('synthetic-private-key');
  });

  it.each([
    ['directory mode', ({ directory }: ReturnType<typeof fixture>) =>
      chmodSync(directory, 0o755)],
    ['file mode', ({ path }: ReturnType<typeof fixture>) =>
      chmodSync(path, 0o644)],
    ['multiple lines', ({ path }: ReturnType<typeof fixture>) =>
      writeFileSync(path, 'first\nsecond\n', { mode: 0o600 })],
    ['empty line', ({ path }: ReturnType<typeof fixture>) =>
      writeFileSync(path, '\n', { mode: 0o600 })],
  ])('rejects an invalid %s', (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(() => readPrivateOpenRouterApiKey(value.path)).toThrow(
      expect.objectContaining({ code: 'OPENROUTER_NOT_CONFIGURED' }),
    );
  });

  it('rejects a symbolic-link key file', () => {
    const target = fixture();
    const linkRoot = mkdtempSync(join(tmpdir(), 'nexus-openrouter-link-'));
    roots.push(linkRoot);
    chmodSync(linkRoot, 0o700);
    const link = join(linkRoot, 'openrouter-api-key');
    symlinkSync(target.path, link);

    expect(() => readPrivateOpenRouterApiKey(link)).toThrow(
      expect.objectContaining({ code: 'OPENROUTER_NOT_CONFIGURED' }),
    );
  });
});
