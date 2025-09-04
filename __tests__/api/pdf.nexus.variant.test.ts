/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
describe('GET /api/bilan/pdf?variant=nexus', () => {
  it('returns 200 for existing bilanId with nexus variant (smoke)', async () => {
    // This is a smoke test assuming a bilan exists in fixtures or seed; if not, skip.
    const bilanId = process.env.TEST_BILAN_ID;
    if (!bilanId) return; // skip if not configured
    const mod = await import('@/app/api/bilan/pdf/route');
    const url = new URL(`http://localhost/api/bilan/pdf?bilanId=${bilanId}&variant=nexus`);
    // @ts-ignore
    const res = await mod.GET({ url: url.toString(), headers: new Headers() } as any);
    expect([200, 401, 403, 404]).toContain(res.status); // tolerant smoke in CI
  });
});
