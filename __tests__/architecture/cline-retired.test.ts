import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CLINE_EXTENSION_ID = 'saoudrizwan.claude-dev';
const CANDIDATES = [
  '.vscode/extensions.json',
  '.cursor/extensions.json',
  '.devcontainer/devcontainer.json',
  '.devcontainer.json',
  'package.json',
  'Makefile',
];

function read(path: string): string {
  const absolute = resolve(process.cwd(), path);
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
}

describe('Cline retirement guard', () => {
  it('does not recommend or install the Cline extension through editor, devcontainer or package config', () => {
    const offenders = CANDIDATES.filter((path) => read(path).includes(CLINE_EXTENSION_ID));
    expect(offenders).toEqual([]);
  });

  it('keeps the Cline guide as a retirement record, not a setup guide', () => {
    const guide = read('docs/dev/CLINE_AGENT_SETUP.md');
    expect(guide).toMatch(/RETIRED/);
    expect(guide).not.toMatch(/Recommended (?:Plan|Act) model|Enter (?:your|the) .*API key|Base URL:/i);
  });
});
