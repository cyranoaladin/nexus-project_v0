import { readFileSync } from 'node:fs';

describe('nginx bearer path logging', () => {
  const nginx = readFileSync('nginx/nginx.conf', 'utf8');
  const productionInclude = readFileSync('ops/nginx/nexus-safe-log.conf', 'utf8');
  const sensitiveLocations = readFileSync('ops/nginx/nexus-sensitive-locations.conf', 'utf8');

  it('redacts signed bilan paths and their referrers before access logging', () => {
    expect(nginx).toContain('map $uri $nexus_safe_uri');
    expect(nginx).toContain('map $http_referer $nexus_safe_referer');
    expect(nginx).toContain('"$request_method $nexus_safe_uri $server_protocol"');
    expect(nginx).toContain('"$nexus_safe_referer"');
    expect(nginx).toContain('~^/bilan/consultation/[^/]+ /bilan/consultation/[REDACTED]');
    expect(nginx).toContain('~^/api/bilan/consultation/[^/]+ /api/bilan/consultation/[REDACTED]');
  });

  it('does not log the raw request or raw referrer', () => {
    expect(nginx).not.toMatch(/log_format\s+nexus_safe[\s\S]*?\$request(?:\s|')/);
    expect(nginx).not.toMatch(/log_format\s+nexus_safe[\s\S]*?\$http_referer/);
  });

  it('ships the same safe format as a production-installable include', () => {
    expect(productionInclude).toContain('map $uri $nexus_safe_uri');
    expect(productionInclude).toContain('map $http_referer $nexus_safe_referer');
    expect(productionInclude).toContain('log_format nexus_safe');
    expect(productionInclude).not.toContain('$request ');
  });

  it('redacts unknown suffixes too, so even a 404 cannot disclose the bearer', () => {
    expect(nginx).not.toMatch(/bilan\/consultation\/\[\^\/\]\+(?:\(\?:|\/consent|\$)/);
    expect(productionInclude).toContain('~^/bilan/consultation/[^/]+ ');
  });

  it('suppresses the raw built-in error log inside bearer-bearing locations', () => {
    for (const location of ['/bilan/consultation/', '/api/bilan/consultation/']) {
      expect(nginx).toContain(`location ^~ ${location}`);
      expect(sensitiveLocations).toContain(`location ^~ ${location}`);
    }
    expect(nginx.match(/error_log \/dev\/null crit;/g)).toHaveLength(2);
    expect(sensitiveLocations.match(/error_log \/dev\/null crit;/g)).toHaveLength(2);
  });
});
