const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');

const workflow = fs.readFileSync(path.join(__dirname, '../../.github/workflows/nexus-review-gate-proof.yml'), 'utf8');
const parsed = yaml.parse(workflow);

describe('trusted Nexus Review Gate identity proof workflow contract', () => {
  test('is triggered from default-branch workflow_run, never from a PR head or dispatchable branch', () => {
    expect(parsed.on.workflow_run).toEqual({ workflows: ['CI Pipeline'], types: ['completed'] });
    expect(Object.keys(parsed.on)).toEqual(['workflow_run']);
    expect(parsed.jobs['prove-app-check'].if).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("[ \"$UPSTREAM_WORKFLOW_ID\" != '185409165' ]");
    expect(workflow).toContain("[ \"$UPSTREAM_WORKFLOW_PATH\" != '.github/workflows/ci.yml' ]");
    expect(workflow).toMatch(/refs\/heads\/main/);
    expect(workflow).toMatch(/ref: \$\{\{ github\.sha \}\}/);
    expect(workflow).toMatch(/github\.event\.workflow_run\.head_sha/);
    expect(workflow).not.toMatch(/pull_request_target:|pull_request:|workflow_dispatch:/);
    expect(workflow).not.toMatch(/ref: \$\{\{ github\.event\.pull_request\.head/);
    expect(workflow).not.toMatch(/npm ci|npm install|download-artifact|NODE_PATH/);
  });

  test('pins the official token action and scopes it to checks write', () => {
    expect(workflow).toMatch(/actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/);
    expect(workflow).toMatch(/client-id: \$\{\{ vars\.NEXUS_REVIEW_GATE_APP_CLIENT_ID \}\}/);
    expect(workflow).toMatch(/private-key: \$\{\{ secrets\.NEXUS_REVIEW_GATE_APP_PRIVATE_KEY \}\}/);
    expect(workflow).toMatch(/permission-checks: write/);
    expect(workflow).not.toMatch(/skip-token-revoke: true|permission-contents: write|permission-administration: write/);
  });

  test('separates native read token from App write token and does not publish success', () => {
    expect(workflow).toMatch(/GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
    expect(workflow).toMatch(/APP_TOKEN: \$\{\{ steps\.app-token\.outputs\.token \}\}/);
    expect(workflow).toMatch(/APP_INSTALLATION_ID: \$\{\{ steps\.app-token\.outputs\.installation-id \}\}/);
    expect(workflow).toMatch(/node scripts\/github\/review-gate\/prove-app-check\.mjs/);
    const publisher = fs.readFileSync(path.join(__dirname, '../../scripts/github/review-gate/prove-app-check.mjs'), 'utf8');
    expect(publisher).toContain("conclusion: 'action_required'");
    expect(publisher).not.toMatch(/conclusion: ['"]success['"]/);
  });
});
