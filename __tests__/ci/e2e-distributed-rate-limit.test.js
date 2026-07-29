const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const workflow = yaml.load(
  fs.readFileSync(path.join(process.cwd(), '.github/workflows/ci.yml'), 'utf8'),
);

describe('E2E distributed rate-limit evidence', () => {
  test('runs the production server against a healthy Redis service', () => {
    const e2e = workflow.jobs.e2e;
    const redis = e2e.services['redis-e2e'];
    const startServer = e2e.steps.find(
      (step) => step.name === 'Start Next.js server in background',
    );

    expect(redis.image).toBe('redis:7.4-alpine');
    expect(redis.ports).toContain('6380:6379');
    expect(redis.options).toContain('redis-cli ping');
    expect(startServer.env.REDIS_URL).toBe('redis://localhost:6380');
    expect(startServer.env.RATE_LIMIT_DISABLE).toBeUndefined();
  });
});
