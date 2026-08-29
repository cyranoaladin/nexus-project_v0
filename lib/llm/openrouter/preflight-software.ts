import 'server-only';

import { execFileSync } from 'node:child_process';

import { OpenRouterError } from './errors';

export function readCleanGitSoftwareSha(
  repositoryRoot = process.cwd(),
): string {
  let sha: string;
  let status: string;
  try {
    sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    status = execFileSync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
  } catch {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
  if (!/^[a-f0-9]{40}$/.test(sha) || status !== '') {
    throw new OpenRouterError('OPENROUTER_POLICY_REJECTED');
  }
  return sha;
}
