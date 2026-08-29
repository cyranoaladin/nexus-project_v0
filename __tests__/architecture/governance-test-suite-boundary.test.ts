import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Governance Test Suite Boundary Architecture Guard', () => {
  const root = process.cwd();
  const governanceTestDir = join(root, '__tests__/governance');
  const unitConfigFile = join(root, 'jest.unit.config.js');
  const governanceConfigFile = join(root, 'jest.config.governance.js');
  const ciWorkflowFile = join(root, '.github/workflows/ci.yml');
  const packageJsonFile = join(root, 'package.json');

  it('governance test directory exists and contains test suites', () => {
    expect(existsSync(governanceTestDir)).toBe(true);
    const files = readdirSync(governanceTestDir).filter((f) => f.endsWith('.test.js'));
    expect(files.length).toBeGreaterThan(5);
  });

  it('jest.unit.config.js explicitly excludes __tests__/governance to prevent ESM cross-contamination', () => {
    expect(existsSync(unitConfigFile)).toBe(true);
    const content = readFileSync(unitConfigFile, 'utf8');
    expect(content).toContain("'<rootDir>/__tests__/governance/'");
  });

  it('jest.config.governance.js explicitly matches all governance test suites', () => {
    expect(existsSync(governanceConfigFile)).toBe(true);
    const content = readFileSync(governanceConfigFile, 'utf8');
    expect(content).toContain("'<rootDir>/__tests__/governance/**/*.test.js'");
  });

  it('package.json defines test:governance with --experimental-vm-modules', () => {
    const pkg = JSON.parse(readFileSync(packageJsonFile, 'utf8'));
    expect(pkg.scripts['test:governance']).toBeDefined();
    expect(pkg.scripts['test:governance']).toContain('--experimental-vm-modules');
    expect(pkg.scripts['test:governance']).toContain('jest.config.governance.js');
  });

  it('.github/workflows/ci.yml executes npm run test:governance in a required CI lane', () => {
    expect(existsSync(ciWorkflowFile)).toBe(true);
    const ciContent = readFileSync(ciWorkflowFile, 'utf8');
    expect(ciContent).toContain('npm run test:governance');
  });
});
