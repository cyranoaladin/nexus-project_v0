export type CoreV2E2eSeedEnvironment = Readonly<Record<string, string | undefined>>;

const ALLOWED_TARGETS: Readonly<Record<string, ReadonlySet<string>>> = Object.freeze({
  localhost: new Set(['5435']),
  '127.0.0.1': new Set(['5435']),
  '[::1]': new Set(['5435']),
  'postgres-core-v2-e2e': new Set(['5432']),
});

const REFUSAL = 'CORE_V2_E2E_SEED_TARGET_REFUSED';

/**
 * Fail-closed guard for the destructive Core v2 E2E seeder.
 *
 * The disposable marker is necessary but never sufficient: the parsed target
 * itself must be the one exact local/CI database provisioned for this lane.
 * Errors are deliberately constant and never echo the URL or credentials.
 */
export function assertCoreV2E2eSeedTarget(env: CoreV2E2eSeedEnvironment): void {
  if (env.E2E_DISPOSABLE_STACK !== '1' && env.NEXUS_DISPOSABLE_POSTGRES !== '1') {
    throw new Error(REFUSAL);
  }

  let target: URL;
  try {
    target = new URL(env.CORE_V2_DATABASE_URL ?? '');
  } catch {
    throw new Error(REFUSAL);
  }

  if (target.protocol !== 'postgres:' && target.protocol !== 'postgresql:') {
    throw new Error(REFUSAL);
  }
  if (target.pathname !== '/core_v2_e2e' || target.search !== '' || target.hash !== '') {
    throw new Error(REFUSAL);
  }

  const allowedPorts = ALLOWED_TARGETS[target.hostname.toLowerCase()];
  if (!allowedPorts?.has(target.port)) throw new Error(REFUSAL);
}
