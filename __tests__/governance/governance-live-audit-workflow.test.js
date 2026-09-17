const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..', '..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');
const auditWorkflowPath = path.join(workflowsDir, 'governance-live-audit.yml');

const GOVERNANCE_TOKEN_NAME = 'NEXUS_GOVERNANCE_READ_TOKEN';
const PR_TRIGGERS = ['pull_request', 'pull_request_target'];

/**
 * The prose in these workflows names the forbidden triggers in order to
 * explain why they are forbidden, so a raw substring search would flag the
 * explanation itself. What must be absent is the trigger *key*, in YAML, not
 * the word in a comment.
 */
function declaresTrigger(text, trigger) {
  return text
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .some((line) => new RegExp(`^\\s*${trigger}\\s*:`).test(line));
}

/**
 * `NEXUS_GOVERNANCE_READ_TOKEN` can read repository administration. Handing it
 * to code that comes from a pull request branch would let any contributor read
 * — and, with a compromised action, exfiltrate — the governance configuration.
 *
 * These are containment rules, not style rules: each one is the reason the
 * token is safe to hold at all.
 */
describe('governance live audit workflow — the read token never meets pull-request code', () => {
  let lib;
  let doc;
  let source;

  beforeAll(async () => {
    lib = await import('../../scripts/github/lib/yaml-workflows.mjs');
    doc = lib.parseWorkflowFile(auditWorkflowPath);
    source = fs.readFileSync(auditWorkflowPath, 'utf8');
  });

  // YAML 1.1 parses a bare `on:` key as the boolean true; the repo's parser
  // normalizes it, but read both so this test cannot pass by accident.
  const triggers = () => doc.on ?? doc[true];

  test('the workflow exists', () => {
    expect(fs.existsSync(auditWorkflowPath)).toBe(true);
  });

  test('it triggers only on push to main, manual dispatch and a schedule', () => {
    expect(Object.keys(triggers()).sort()).toEqual(['push', 'schedule', 'workflow_dispatch']);
    expect(triggers().push.branches).toEqual(['main']);
  });

  test.each(PR_TRIGGERS)('it declares no %s trigger, in the parsed document or the YAML keys', (trigger) => {
    expect(Object.keys(triggers())).not.toContain(trigger);
    expect(declaresTrigger(source, trigger)).toBe(false);
  });

  test('the workflow grants read-only permissions', () => {
    expect(doc.permissions).toEqual({ contents: 'read' });
  });

  test('the secret is mapped inside steps, never at workflow or job level', () => {
    expect(doc.env ?? {}).not.toHaveProperty('GH_TOKEN');
    for (const job of Object.values(doc.jobs)) {
      const jobEnv = JSON.stringify(job.env ?? {});
      expect(jobEnv).not.toContain(GOVERNANCE_TOKEN_NAME);
    }
    const stepsUsingSecret = Object.values(doc.jobs)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => JSON.stringify(step.env ?? {}).includes(GOVERNANCE_TOKEN_NAME));
    expect(stepsUsingSecret.length).toBeGreaterThan(0);
  });

  test('a step refuses any ref other than main before the secret is read', () => {
    const steps = Object.values(doc.jobs).flatMap((job) => job.steps ?? []);
    const refGuardIndex = steps.findIndex((step) => (step.run ?? '').includes('refs/heads/main'));
    const firstSecretIndex = steps.findIndex((step) => JSON.stringify(step.env ?? {}).includes(GOVERNANCE_TOKEN_NAME));
    expect(refGuardIndex).toBeGreaterThanOrEqual(0);
    expect(firstSecretIndex).toBeGreaterThan(refGuardIndex);
  });

  test('no step prints the secret', () => {
    const steps = Object.values(doc.jobs).flatMap((job) => job.steps ?? []);
    for (const step of steps) {
      const run = step.run ?? '';
      expect(run).not.toMatch(/echo[^\n]*\$\{?GH_TOKEN/);
      expect(run).not.toMatch(/echo[^\n]*GOVERNANCE_TOKEN["}\s]*$/m);
      expect(run).not.toContain(`secrets.${GOVERNANCE_TOKEN_NAME}`);
    }
  });

  test('it runs the live audit through the npm script, not an ad-hoc command', () => {
    const runs = Object.values(doc.jobs)
      .flatMap((job) => job.steps ?? [])
      .map((step) => step.run ?? '')
      .join('\n');
    expect(runs).toContain('npm run governance:audit:live');
  });
});

describe('repository-wide containment of the governance read token', () => {
  const workflowFiles = fs
    .readdirSync(workflowsDir)
    .filter((entry) => /\.ya?ml$/.test(entry))
    .map((entry) => path.join(workflowsDir, entry));

  test('only the live audit workflow references the token', () => {
    const referencing = workflowFiles
      .filter((file) => fs.readFileSync(file, 'utf8').includes(GOVERNANCE_TOKEN_NAME))
      .map((file) => path.basename(file));
    expect(referencing).toEqual(['governance-live-audit.yml']);
  });

  test('no workflow that a pull request can trigger references the token', () => {
    for (const file of workflowFiles) {
      const text = fs.readFileSync(file, 'utf8');
      if (!text.includes(GOVERNANCE_TOKEN_NAME)) continue;
      for (const trigger of PR_TRIGGERS) {
        expect({ file: path.basename(file), trigger, declared: declaresTrigger(text, trigger) })
          .toEqual({ file: path.basename(file), trigger, declared: false });
      }
    }
  });
});
