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

  test('App key is present only in the read-only evaluator job and token is checks-only', () => {
    const evaluate = parsed.jobs.evaluate;
    const automate = parsed.jobs.automate;
    expect(parsed.permissions['pull-requests']).toBe('read');
    expect(parsed.permissions.checks).toBe('read');
    expect(evaluate.permissions).toBeUndefined();
    expect(evaluate.steps[2].uses).toMatch(/^actions\/create-github-app-token@[0-9a-f]{40}$/);
    expect(evaluate.steps[2].with['permission-checks']).toBe('write');
    expect(automate.permissions['pull-requests']).toBe('write');
    expect(automate.if).toBe("needs.evaluate.outputs.conclusion == 'success'");
    expect(JSON.stringify(automate)).not.toContain('NEXUS_REVIEW_GATE_APP_PRIVATE_KEY');
    expect(workflow).not.toMatch(/permission-contents: write|permission-administration: write/);
  });
});
