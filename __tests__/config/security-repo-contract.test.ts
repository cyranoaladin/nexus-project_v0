import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(__dirname, '../..');

describe('security:repo contract', () => {
  it('calls check-no-private-keys', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    const securityRepo = pkg.scripts['security:repo'];
    expect(securityRepo).toBeDefined();
    expect(securityRepo).toContain('check-no-private-keys.sh');
  });
});
