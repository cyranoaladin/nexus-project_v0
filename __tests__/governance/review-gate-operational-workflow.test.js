const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/nexus-review-gate.yml'), 'utf8');
const parsed = yaml.parse(workflow);

describe('trusted operational workflow contract', () => {
  test('has only a default-branch workflow_run trigger and trusted checkout', () => {
    expect(Object.keys(parsed.on)).toEqual(['workflow_run']);
    expect(parsed.on.workflow_run).toEqual({ workflows: ['CI Pipeline'], types: ['completed'] });
    expect(workflow).toContain("github.event.workflow_run.event == 'pull_request'");
    expect(workflow).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    for (const job of Object.values(parsed.jobs)) {
      const checkouts = job.steps.filter((step) => step.uses?.startsWith('actions/checkout@'));
      expect(checkouts).toHaveLength(1);
      expect(checkouts[0].with.ref).toBe('${{ github.sha }}');
      expect(checkouts[0].with['persist-credentials']).toBe(false);
    }
    expect(workflow).not.toMatch(/npm ci|npm install|download-artifact|ref:\s*\$\{\{\s*github\.event\.workflow_run\.head_sha/);
  });

  test('App key is present only in the read-only evaluator job; no PR mutation job is armed', () => {
    const evaluate = parsed.jobs.evaluate;
    expect(Object.keys(parsed.jobs)).toEqual(['evaluate']);
    expect(parsed.permissions['pull-requests']).toBe('read');
    expect(parsed.permissions.checks).toBe('read');
    expect(evaluate.permissions).toBeUndefined();
    expect(evaluate.steps[2].uses).toMatch(/^actions\/create-github-app-token@[0-9a-f]{40}$/);
    expect(evaluate.steps[2].with['permission-checks']).toBe('write');
    expect(workflow).not.toContain('pull-requests: write');
    expect(workflow).not.toContain('automation-entry.mjs');
    expect(workflow).not.toMatch(/permission-contents: write|permission-administration: write/);
  });
});
