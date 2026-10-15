/** Garde V1 du seed E2E : aucune dépendance à Core v2 (utilisable hors de scripts/core-v2). */
export type V1E2eSeedEnvironment = Readonly<Record<string, string | undefined>>;

/** V1 must independently be the exact disposable authority database. */
export function assertCoreV1E2eSeedTarget(env: V1E2eSeedEnvironment): void {
  try {
    if (env.E2E_DISPOSABLE_STACK !== '1' && env.NEXUS_DISPOSABLE_POSTGRES !== '1') throw new Error();
    const target = new URL(env.DATABASE_URL ?? '');
    const ports = target.hostname === 'postgres-e2e' ? ['5432']
      : ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ? ['5433', '5435'] : [];
    if (target.protocol !== 'postgresql:' || target.pathname !== '/nexus_e2e' || !ports.includes(target.port)
      || !['', '?schema=public'].includes(target.search) || target.hash !== '') throw new Error();
  } catch { throw new Error('V1_E2E_SEED_TARGET_REFUSED'); }
}
