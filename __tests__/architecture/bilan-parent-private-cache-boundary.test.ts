import nextConfig from '../../next.config.mjs';

describe('Parent bilan private-cache boundary', () => {
  test('final Next.js headers preserve private no-store for every Parent report endpoint', async () => {
    if (typeof nextConfig.headers !== 'function') {
      throw new Error('NEXT_HEADERS_CONFIGURATION_MISSING');
    }
    const rules = await nextConfig.headers();
    const expectedSources = [
      '/api/parent/children/:studentId/bilans',
      '/api/parent/children/:studentId/bilans/:attemptId/report',
      '/api/parent/bilans/:id/pdf',
    ];

    for (const source of expectedSources) {
      const rule = rules.find((candidate) => candidate.source === source);
      expect(rule).toBeDefined();
      expect(rule?.headers).toEqual(expect.arrayContaining([
        { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
        { key: 'Pragma', value: 'no-cache' },
        { key: 'Expires', value: '0' },
      ]));
    }
  });

  test('standalone tracing retains every dynamically-read print font', () => {
    const traced = nextConfig.outputFileTracingIncludes?.['/*'];
    expect(traced).toEqual(expect.arrayContaining([
      './app/fonts/Fraunces-Variable.woff2',
      './app/fonts/DMSans-Variable.woff2',
    ]));
  });
});
