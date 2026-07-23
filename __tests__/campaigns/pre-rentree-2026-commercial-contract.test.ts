import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  compileCommercialPublicationContract,
  getCommercialPublicOffers,
} from '@/lib/campaigns/pre-rentree-2026/commercial-contract';
import { getRules } from '@/lib/pricing';

const root = process.cwd();

describe('Pré-rentrée 2026 canonical commercial publication contract', () => {
  it('keeps every public amount derived from canonical pricing', () => {
    const source = JSON.parse(readFileSync(
      join(root, 'content/pre-rentree-2026/commercial-contract.fr.json'),
      'utf8',
    ));
    const forbiddenAmountKeys: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (['price', 'deposit', 'balance', 'amount'].includes(key)) forbiddenAmountKeys.push(`${path}/${key}`);
        visit(child, `${path}/${key}`);
      }
    };
    visit(source, '');

    expect(forbiddenAmountKeys).toEqual([]);

    const compiled = compileCommercialPublicationContract();
    const byId = new Map(compiled.offers.map((offer) => [offer.offerId, offer]));
    expect(byId.get('pre2026-3e-mathematiques')).toMatchObject({
      pricingId: 'pre2026-foundations-3e-subject',
      price: 350,
      deposit: 105,
      hours: 10,
      sessions: 5,
      groupMin: 4,
      groupMax: 6,
    });
    expect(byId.get('pre2026-seconde-physique-chimie')).toMatchObject({ price: 400, deposit: 120 });
    expect(byId.get('pre2026-premiere-pack-1')).toMatchObject({ price: 480, deposit: 144, groupMax: 5 });
    expect(byId.get('pre2026-terminale-pack-4')).toMatchObject({ price: 1800, deposit: 540, groupMax: 5 });
  });

  it('records the approved 3e exception without weakening the global college floor', () => {
    const compiled = compileCommercialPublicationContract();
    const exception = compiled.proofs.proofs.find(
      (proof) => proof.proofId === 'PRF-PRE2026-3E-350-APPROVED',
    );

    expect(getRules().price_floor_per_student_hour_tnd.stage_college).toBe(40);
    expect(compiled.pricingExceptions).toEqual([expect.objectContaining({
      exceptionId: 'PRE2026-3E-350',
      editionId: 'pre-rentree-2026',
      approvedAt: '2026-07-20',
      status: 'APPROVED',
      pricePerStudentHour: 35,
      standardFloorPerStudentHour: 40,
    })]);
    expect(exception).toMatchObject({ status: 'APPROVED', approvedAt: '2026-07-20' });
  });

  it('publishes only level-appropriate subjects and approved benefits', () => {
    const offers = getCommercialPublicOffers();
    const secondeSubjects = offers
      .filter((offer) => offer.level === 'SECONDE')
      .flatMap((offer) => offer.subjects);
    const allPublicText = JSON.stringify(offers);

    expect(new Set(secondeSubjects)).toEqual(new Set([
      'MATHEMATIQUES',
      'PHYSIQUE_CHIMIE',
      'FRANCAIS',
    ]));
    expect(allPublicText).not.toMatch(/SNT/i);
    expect(allPublicText).not.toMatch(/manuel offert|remise annuelle|réduction annuelle|10\s*%/i);
    expect(offers.every((offer) => offer.proofIds.length > 0 && offer.publiclyEligible)).toBe(true);
  });

  it('keeps unresolved benefits in the decisions registry instead of public offers', () => {
    const compiled = compileCommercialPublicationContract();
    const decisions = new Map(compiled.proofs.decisions.map((decision) => [decision.decisionId, decision]));

    expect(decisions.get('DEC-PRE2026-MANUAL-BENEFIT')).toMatchObject({ status: 'PENDING' });
    expect(decisions.get('DEC-PRE2026-ANNUAL-DISCOUNT')).toMatchObject({ status: 'PENDING' });
    expect(decisions.get('DEC-PRE2026-SECONDE-SNT')).toMatchObject({ status: 'CLOSED_EXCLUDED' });
  });
});
