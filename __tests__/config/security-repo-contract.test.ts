import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../..');

describe('security:repo contract', () => {
  it('calls both check-no-private-keys and security:telegram', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const securityRepo = pkg.scripts['security:repo'];
    expect(securityRepo).toBeDefined();
    expect(securityRepo).toContain('check-no-private-keys.sh');
    expect(securityRepo).toContain('security:telegram');
  });

  it('defines the security:telegram script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    expect(pkg.scripts['security:telegram']).toBeDefined();
    expect(pkg.scripts['security:telegram']).toContain('check-telegram-secrets');
  });
});
