/**
 * validate-next-traces.js secret-detection classifier — isRealEnvFile must
 * block genuine .env files while allowing safe templates and diffs of them.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { isRealEnvFile, classifyFile } = require('../../scripts/next-traces-classifiers');

describe('isRealEnvFile', () => {
  it('flags real .env files', () => {
    expect(isRealEnvFile('/app/.env')).toBe(true);
    expect(isRealEnvFile('/app/.env.local')).toBe(true);
    expect(isRealEnvFile('/app/.env.production')).toBe(true);
  });

  it('allows safe example/sample/template suffixes', () => {
    expect(isRealEnvFile('/app/.env.example')).toBe(false);
    expect(isRealEnvFile('/app/.env.sample')).toBe(false);
    expect(isRealEnvFile('/app/.env.template')).toBe(false);
    expect(isRealEnvFile('/app/.env.production.example')).toBe(false);
  });

  it('allows a diff of an already-safe example/sample/template file', () => {
    expect(isRealEnvFile('/docs/convergence/evidence/diffs/.env.example.diff')).toBe(false);
    expect(isRealEnvFile('/docs/convergence/evidence/diffs/.env.production.example.diff')).toBe(false);
    expect(isRealEnvFile('/x/.env.sample.diff')).toBe(false);
    expect(isRealEnvFile('/x/.env.template.diff')).toBe(false);
  });

  it('still flags a diff of a REAL .env file — stripping .diff must not create a new bypass', () => {
    expect(isRealEnvFile('/x/.env.diff')).toBe(true);
    expect(isRealEnvFile('/x/.env.production.diff')).toBe(true);
    expect(isRealEnvFile('/x/.env.local.diff')).toBe(true);
  });

  it('ignores files that are not dotenv-shaped at all', () => {
    expect(isRealEnvFile('/x/environment.ts')).toBe(false);
    expect(isRealEnvFile('/x/README.md')).toBe(false);
    expect(isRealEnvFile('/x/some.env.txt')).toBe(false); // does not start with ".env"
  });
});

describe('classifyFile', () => {
  it('classifies by extension', () => {
    expect(classifyFile('/x/a.js')).toBe('javascript');
    expect(classifyFile('/x/a.tsx')).toBe('typescript');
    expect(classifyFile('/x/a.json')).toBe('json');
    expect(classifyFile('/x/a.node')).toBe('native-addon');
    expect(classifyFile('/x/a.css')).toBe('style');
    expect(classifyFile('/x/a.wasm')).toBe('wasm');
    expect(classifyFile('/x/a.diff')).toBe('other');
  });
});
