import nextConfig from '../../next.config.mjs';

describe('Redirection du stage Printemps 2026', () => {
  it('redirige uniquement la fiche legacy en 301 vers la liste des stages', async () => {
    if (typeof nextConfig.redirects !== 'function') {
      throw new Error('NEXT_REDIRECTS_CONFIGURATION_MISSING');
    }

    const redirects = await nextConfig.redirects();
    const legacyRedirects = redirects.filter(
      (redirect) => redirect.source === '/stages/printemps-2026',
    );

    expect(legacyRedirects).toEqual([
      {
        source: '/stages/printemps-2026',
        destination: '/stages',
        statusCode: 301,
      },
    ]);
    expect(redirects).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: '/stages/printemps-2026/inscription',
      }),
    ]));
    expect(redirects.some((redirect) => (
      redirect.source.startsWith('/stages/printemps-2026/')
      && /[:*]/.test(redirect.source)
    ))).toBe(false);
  });
});
