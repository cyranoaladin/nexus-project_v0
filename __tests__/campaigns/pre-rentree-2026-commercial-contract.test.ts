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
      groupMin: 3,
      groupMax: 6,
    });
    expect(byId.get('pre2026-seconde-mathematiques')).toMatchObject({ price: 400, deposit: 120 });
    expect(byId.get('pre2026-premiere-pack-1')).toMatchObject({ price: 480, deposit: 144, groupMax: 5 });
    expect(byId.get('pre2026-terminale-pack-4')).toMatchObject({ price: 1800, deposit: 540, groupMax: 5 });
  });

  it('records the approved 3e exception without weakening the global college floor', () => {
    const compiled = compileCommercialPublicationContract();
    const exception = compiled.proofs.proofs.find(
      (proof) => proof.proofId === 'PRF-PRE2026-3E-350-APPROVED',
    );

    expect(getRules().price_floor_per_student_hour_tnd.stage_college).toBe(40);
    // Deux exceptions désormais : 3e (préexistante) et 4e (mission 4e/Philosophie,
    // même mécanisme). Vérifie la présence de chacune sans exiger l'exclusivité.
    expect(compiled.pricingExceptions).toContainEqual(expect.objectContaining({
      exceptionId: 'PRE2026-3E-350',
      editionId: 'pre-rentree-2026',
      approvedAt: '2026-07-20',
      status: 'APPROVED',
      pricePerStudentHour: 35,
      standardFloorPerStudentHour: 40,
    }));
    expect(compiled.pricingExceptions).toContainEqual(expect.objectContaining({
      exceptionId: 'PRE2026-4E-350',
      editionId: 'pre-rentree-2026',
      status: 'APPROVED',
      pricePerStudentHour: 35,
      standardFloorPerStudentHour: 40,
    }));
    expect(exception).toMatchObject({ status: 'APPROVED', approvedAt: '2026-07-20' });
  });

  // docs/audits/2026-07-29-decision-1ter-structural-transfer-objects.md:
  // compileCommercialPublicationContract() computes `pricingExceptions`
  // (carrying `justification`, an internal pricing-strategy note structurally
  // identical to carte_nexus.rationale) alongside the public `offers`. No
  // current caller propagates pricingExceptions to a page today — but nothing
  // enforces that. This is the "one test per source, fails on any unlisted
  // field" guard for this source: an explicit allowlist, not a blocklist.
  const PUBLIC_OFFER_ALLOWED_KEYS = new Set([
    'offerId', 'pricingId', 'pricingKind', 'level', 'subjects', 'subjectCount',
    'audience', 'objectives', 'included', 'optional', 'excluded', 'supports',
    'followUp', 'cta', 'proofIds', 'publicStatus', 'approvers', 'validatedAt',
    'lastRevisedAt', 'hours', 'sessions', 'sessionDurationHours', 'groupMin',
    'groupMax', 'price', 'deposit', 'balance', 'currency', 'publiclyEligible',
  ]);

  it('getCommercialPublicOffers() never carries a key outside the public allowlist', () => {
    const offers = getCommercialPublicOffers();
    expect(offers.length).toBeGreaterThan(0);
    const unexpectedKeys = new Set<string>();
    for (const offer of offers) {
      for (const key of Object.keys(offer)) {
        if (!PUBLIC_OFFER_ALLOWED_KEYS.has(key)) unexpectedKeys.add(key);
      }
    }
    expect([...unexpectedKeys]).toEqual([]);
    // Belt and suspenders: the specific internal fields must never appear,
    // by name, anywhere in the serialized public offers.
    const serialized = JSON.stringify(offers);
    expect(serialized).not.toMatch(/justification|approvedByRole|exceptionId|editionId|standardFloorPerStudentHour/i);
  });

  it('publishes only level-appropriate subjects and approved benefits', () => {
    const offers = getCommercialPublicOffers();
    const secondeSubjects = offers
      .filter((offer) => offer.level === 'SECONDE')
      .flatMap((offer) => offer.subjects);
    const allPublicText = JSON.stringify(offers);

    expect(new Set(secondeSubjects)).toEqual(new Set([
      'MATHEMATIQUES',
      'FRANCAIS',
    ]));
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
