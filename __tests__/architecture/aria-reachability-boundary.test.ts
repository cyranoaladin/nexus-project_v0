import { execFileSync } from 'node:child_process';

describe('H010 ARIA runtime reachability boundary', () => {
  it('proves every ARIA runtime module is reachable from a product or operational entrypoint', () => {
    const output = execFileSync('npm', ['run', 'aria:reachability'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    expect(output).toContain('ARIA_DEAD_CODE=0');
    expect(output).toContain('ARIA_ORPHANS=0');
    expect(output).toContain('ARIA_ZOMBIES=0');
  });
});
