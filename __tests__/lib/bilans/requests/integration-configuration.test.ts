import { readFileSync } from 'node:fs';
import path from 'node:path';

import { BILAN_FEATURE_FLAG_NAMES } from '@/lib/bilans/requests/feature-flags';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('canonical bilan integration configuration', () => {
  const environmentExample = source('.env.example');
  const productionCompose = source('docker-compose.prod.yml');
  const nextConfig = source('next.config.mjs');

  it('documents and forwards every server-only feature flag as disabled by default', () => {
    for (const name of BILAN_FEATURE_FLAG_NAMES) {
      expect(environmentExample).toMatch(new RegExp(`^${name}=false$`, 'm'));
      expect(productionCompose).toContain(`${name}: \${${name}:-false}`);
    }
  });

  it('centralizes distributed rate-limit and team-notification variables without secrets', () => {
    for (const name of [
      'REDIS_URL',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'RATE_LIMIT_DISTRIBUTED_TIMEOUT_MS',
      'BILAN_TEAM_NOTIFICATION_EMAIL',
    ]) {
      expect(environmentExample).toMatch(new RegExp(`^${name}=`, 'm'));
      expect(productionCompose).toContain(`${name}: \${${name}`);
    }
    expect(environmentExample).not.toMatch(/^UPSTASH_REDIS_REST_TOKEN=\S{24,}$/m);
  });

  it('packages canonical internal sources only with the bilan API server trace', () => {
    expect(nextConfig).toContain("'/api/bilan-gratuit/v1/**/*'");
    expect(nextConfig).toContain("'./content/pre-rentree-2026/modules.json'");
    expect(nextConfig).toContain("'./content/pre-rentree-2026/pedagogy/**/*'");
    expect(nextConfig).not.toContain("public/pre-rentree-2026/pedagogy");
  });
});
