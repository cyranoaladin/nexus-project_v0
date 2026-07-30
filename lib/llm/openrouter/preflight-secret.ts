import 'server-only';

import { lstatSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { OpenRouterError } from './errors';

const SECRET_DIRECTORY_MODE = 0o700;
const SECRET_FILE_MODE = 0o600;

function assertOwnedMode(
  path: string,
  expectedMode: number,
  expectedKind: 'directory' | 'file',
): void {
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
  }
  const localUid = process.getuid?.();
  if (
    stat.isSymbolicLink()
    || (expectedKind === 'directory' ? !stat.isDirectory() : !stat.isFile())
    || (stat.mode & 0o777) !== expectedMode
    || (localUid !== undefined && stat.uid !== localUid)
  ) {
    throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
  }
}

export function defaultOpenRouterApiKeyPath(): string {
  return join(
    homedir(),
    '.config',
    'nexus-secrets',
    'openrouter-api-key',
  );
}

export function readPrivateOpenRouterApiKey(
  keyPath = defaultOpenRouterApiKeyPath(),
): string {
  assertOwnedMode(dirname(keyPath), SECRET_DIRECTORY_MODE, 'directory');
  assertOwnedMode(keyPath, SECRET_FILE_MODE, 'file');
  const raw = readFileSync(keyPath, 'utf8');
  const lines = raw.endsWith('\n') ? raw.slice(0, -1).split('\n') : raw.split('\n');
  if (
    lines.length !== 1
    || lines[0].trim() === ''
    || lines[0] !== lines[0].trim()
    || lines[0].includes('\r')
  ) {
    throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
  }
  return lines[0];
}
