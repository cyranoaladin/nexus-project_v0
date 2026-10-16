/**
 * Le catalogue embarqué côté navigateur doit rester identique au socle canonique.
 *
 * Si ce test échoue : node scripts/generate-pricing-client-data.js
 *
 * Le catalogue vit dans son propre fichier engendré, et non dans
 * pricing-client-data.generated.json, pour qu'il ne pèse que sur la page des
 * manuels et pas sur toutes les pages qui lisent les règles tarifaires.
 */
import { MANUELS_CATALOGUE, getManuelsBaremeClient } from '@/lib/manuels/catalogue-client';
import pricingData from '@/data/pricing.canonical.json';

const canonical = pricingData as unknown as { manuels: typeof MANUELS_CATALOGUE };

describe('catalogue manuels — synchronisation client', () => {
  it('le barème embarqué est celui du socle canonique', () => {
    expect(getManuelsBaremeClient()).toEqual(canonical.manuels.bareme);
  });

  it('les volumes embarqués sont ceux du socle canonique', () => {
    expect(MANUELS_CATALOGUE.volumes).toEqual(canonical.manuels.volumes);
  });

  it('les disciplines embarquées sont celles du socle canonique', () => {
    expect(MANUELS_CATALOGUE.disciplines).toEqual(canonical.manuels.disciplines);
  });

  it('la version embarquée est celle du socle canonique', () => {
    expect(MANUELS_CATALOGUE.version).toBe(canonical.manuels.version);
  });
});
