import 'server-only';

import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  type Stats,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { OpenRouterError } from './errors';

const SECRET_DIRECTORY_MODE = 0o700;
const SECRET_FILE_MODE = 0o600;
const MAX_SECRET_BYTES = 4_096;

function hasExpectedOwnershipAndMode(
  stat: Stats,
  expectedMode: number,
  expectedKind: 'directory' | 'file',
): boolean {
  const localUid = process.getuid?.();
  return !(
    (expectedKind === 'directory' ? !stat.isDirectory() : !stat.isFile())
    || (stat.mode & 0o777) !== expectedMode
    || (localUid !== undefined && stat.uid !== localUid)
  );
}

function assertOwnedDirectory(path: string): void {
  try {
    const stat = lstatSync(path);
    if (
      stat.isSymbolicLink()
      || !hasExpectedOwnershipAndMode(
        stat,
        SECRET_DIRECTORY_MODE,
        'directory',
      )
    ) {
      throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
    }
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
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
  assertOwnedDirectory(dirname(keyPath));
  let descriptor: number;
  try {
    descriptor = openSync(
      keyPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
  } catch {
    throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
  }
  let raw: string;
  try {
    const stat = fstatSync(descriptor);
    if (
      !hasExpectedOwnershipAndMode(stat, SECRET_FILE_MODE, 'file')
      || stat.size <= 0
      || stat.size > MAX_SECRET_BYTES
    ) {
      throw new OpenRouterError('OPENROUTER_NOT_CONFIGURED');
    }
    raw = readFileSync(descriptor, 'utf8');
  } finally {
    closeSync(descriptor);
  }
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
