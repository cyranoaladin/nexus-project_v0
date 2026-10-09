// Framework signing/encryption material belongs inside a confidential archive,
// including when the application source and Actions artifacts are public.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function encryptArchive(input, recipient, output) {
  if (!input || !recipient || !output) throw new Error('ENCRYPTION_ARGUMENTS_REQUIRED');
  if (!fs.statSync(input).isFile() || !fs.statSync(recipient).isFile()) throw new Error('ENCRYPTION_INPUT_INVALID');
  if (fs.existsSync(output)) throw new Error('ENCRYPTION_OUTPUT_EXISTS');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-public-encryption-'));
  fs.chmodSync(home, 0o700);
  const temporary = path.join(home, 'archive.gpg');
  try {
    const result = spawnSync('gpg', [
      '--no-options', '--homedir', home, '--batch', '--no-tty',
      '--trust-model', 'always', '--compress-algo', 'none', '--cipher-algo', 'AES256',
      '--recipient-file', path.resolve(recipient), '--output', temporary,
      '--encrypt', path.resolve(input),
    ], { stdio: 'ignore' });
    if (result.status !== 0 || !fs.existsSync(temporary) || fs.statSync(temporary).size === 0) {
      throw new Error('ARCHIVE_ENCRYPTION_FAILED');
    }
    // Exclusive copy: a concurrent invocation cannot replace a sealed release.
    fs.copyFileSync(temporary, output, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(output, 0o600);
  } finally {
    // Only this invocation's ephemeral PUBLIC keyring and ciphertext are removed.
    fs.rmSync(home, { recursive: true, force: true });
  }
}

try {
  encryptArchive(...process.argv.slice(2));
  console.log('RELEASE_ARCHIVE_ENCRYPTED');
} catch {
  // Do not forward subprocess diagnostics or input contents to public CI logs.
  console.error('RELEASE_ARCHIVE_ENCRYPTION_FAILED');
  process.exitCode = 1;
}
