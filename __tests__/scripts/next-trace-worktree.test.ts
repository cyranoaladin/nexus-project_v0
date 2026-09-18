import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

it.each([
  ['lib/runtime.js', true],
  ['.worktrees/another/lib/runtime.js', false],
  ['../another/lib/runtime.js', false],
  ['.git/config', false],
  ['.env.production', false],
])('audits artifact-relative content from a worktree: %s', (source, allowed) => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-trace-boundary-'));
  try {
    const project = path.join(temporary, '.worktrees', 'candidate');
    const build = path.join(project, '.next');
    const manifest = path.join(build, 'server', 'runtime.js.nft.json');
    const target = path.join(project, source as string);
    fs.mkdirSync(path.dirname(manifest), { recursive: true });
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'synthetic fixture');
    fs.writeFileSync(manifest, JSON.stringify({ files: [path.relative(path.dirname(manifest), target)] }));
    const result = spawnSync(process.execPath, [path.join(process.cwd(), 'scripts/validate-next-traces.js'), build], { encoding: 'utf8' });
    expect(JSON.parse(result.stdout).passed).toBe(allowed);
    expect(result.status).toBe(allowed ? 0 : 1);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
