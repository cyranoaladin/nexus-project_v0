/** @jest-environment node */
import { bootstrapE2eCoreV2Admin } from '@/scripts/core-v2/bootstrap-e2e-admin';

const disposable = {
  E2E_DISPOSABLE_STACK: '1',
  CORE_V2_AUTH_MODE: 'V1_ONLY',
  DATABASE_URL: 'postgresql://postgres@localhost:5433/nexus_e2e',
  CORE_V2_DATABASE_URL: 'postgresql://postgres@localhost:5435/core_v2_e2e',
};

describe('bootstrap ADMIN Core v2 des piles e2e jetables', () => {
  test.each([
    ['sans marqueur jetable', { ...disposable, E2E_DISPOSABLE_STACK: undefined }, 'CORE_V2_E2E_SEED_TARGET_REFUSED'],
    ['vers une base Core v2 non jetable', { ...disposable, CORE_V2_DATABASE_URL: 'postgresql://postgres@db.example.test:5432/core_v2' }, 'CORE_V2_E2E_SEED_TARGET_REFUSED'],
    ['vers une base V1 non jetable', { ...disposable, DATABASE_URL: 'postgresql://postgres@db.example.test:5432/nexus' }, 'V1_E2E_SEED_TARGET_REFUSED'],
    ['hors V1_ONLY', { ...disposable, CORE_V2_AUTH_MODE: 'HYBRID' }, 'E2E_BOOTSTRAP_REQUIRES_V1_ONLY'],
  ])('refuse %s, avant toute connexion', async (_cas, env, code) => {
    await expect(bootstrapE2eCoreV2Admin(env)).rejects.toThrow(code);
  });
});
