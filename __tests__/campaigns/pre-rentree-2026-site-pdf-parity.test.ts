/**
 * Fact parity between the two live compilation layers (Lot 1.6): the public
 * website (lib/campaigns/pre-rentree-2026/public-surface.ts) and the PDF
 * pipeline (scripts/pre-rentree/publication-derivations.ts) independently
 * re-derive overlapping facts from the same campaign/pricing sources. As
 * long as the editorial-unification work (Lot 3) hasn't merged them into one
 * compiler, nothing prevents them from silently drifting apart on a FACT — a
 * family could be shown one volume/price/date on the site and a different
 * one in the PDF they downloaded five minutes later.
 *
 * This file compares only FACTS: levels, subjects per level, scheduled
 * occurrences (date/level/subject/block), prices/deposits/balances, module
 * and session counts, and the pack subject-count ceiling. It deliberately
 * does NOT compare editorial wording (FAQ text, hero copy, method steps) —
 * that divergence is real, known, and explicitly deferred to Lot 3.
 */
import { getPreRentreeCampaign, getPreRentreeSchedule, getPreRentreeModules } from '@/lib/campaigns/pre-rentree-2026/getters';
import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import { MAX_SUBJECTS_PER_PACK } from '@/lib/campaigns/pre-rentree-2026/configurator';
import { getPreRentreePacks } from '@/lib/pricing';
import rawModulesDocument from '@/content/pre-rentree-2026/modules.json';
import {
  deriveSchedule,
  derivePacks,
} from '../../scripts/pre-rentree/publication-derivations';

describe('Pré-rentrée 2026 — parity between the site and the PDF pipeline (facts only)', () => {
  const campaign = getPreRentreeCampaign();
  const siteDto = compilePreRentreeReviewSurfaceDTO();
  const pdfSchedule = deriveSchedule(campaign);
  const pdfPacks = derivePacks(getPreRentreePacks(campaign.packProductIds));

  it('agree on the 4 canonical levels', () => {
    const siteLevelIds = siteDto.levels.map((level) => level.id).sort();
    const pdfLevelIds = campaign.levels.map((level) => level.id).sort();
    expect(siteLevelIds).toEqual(pdfLevelIds);
  });

  it('agree on which subjects are available at each level', () => {
    for (const level of campaign.levels) {
      const siteSubjects = [...siteDto.subjectIdsByLevel[level.id]].sort();
      const pdfSubjects = campaign.subjects
        .filter((subject) => subject.levels.includes(level.id))
        .map((subject) => subject.id)
        .sort();
      expect(siteSubjects).toEqual(pdfSubjects);
    }
  });

  it('agree on every scheduled occurrence (date, level, subject, block)', () => {
    const siteOccurrences = getPreRentreeSchedule()
      .map((session) => `${session.date}|${session.level}|${session.subject}|${session.block}|${session.cohortId ?? ''}`)
      .sort();
    const pdfOccurrences = pdfSchedule.sessions
      .map((session) => `${session.date}|${session.level}|${session.subjectId}|${session.blockId}|${session.cohortId ?? ''}`)
      .sort();
    expect(siteOccurrences).toEqual(pdfOccurrences);
    expect(siteOccurrences.length).toBe(pdfOccurrences.length);
  });

  it('agree on Fondations/Premium group size ranges', () => {
    expect(siteDto.planning.capacityByOffer.FONDATIONS).toEqual({
      minPerCohort: campaign.capacityByOffer.FONDATIONS.minPerCohort,
      maxPerCohort: campaign.capacityByOffer.FONDATIONS.maxPerCohort,
    });
    expect(siteDto.planning.capacityByOffer.PREMIUM).toEqual({
      minPerCohort: campaign.capacityByOffer.PREMIUM.minPerCohort,
      maxPerCohort: campaign.capacityByOffer.PREMIUM.maxPerCohort,
    });
  });

  it('agree on Premium price/deposit/balance for every subject count (Première and Terminale)', () => {
    for (const level of ['PREMIERE', 'TERMINALE'] as const) {
      const siteOffersForLevel = siteDto.offers.filter((offer) => offer.level === level && offer.pricingKind === 'PREMIUM_PACK');
      expect(siteOffersForLevel.length).toBeGreaterThan(0);
      for (const siteOffer of siteOffersForLevel) {
        const pdfPack = pdfPacks.find((pack) => pack.subjectCount === siteOffer.subjectCount);
        if (!pdfPack) throw new Error(`No PDF pack for subjectCount ${siteOffer.subjectCount}`);
        expect(siteOffer.price).toBe(pdfPack.price);
        expect(siteOffer.deposit).toBe(pdfPack.deposit);
        expect(siteOffer.balance).toBe(pdfPack.balance);
        expect(siteOffer.hours).toBe(pdfPack.totalHours);
      }
    }
  });

  it('agree on the module and session-template counts', () => {
    const siteModules = getPreRentreeModules();
    expect(siteModules.length).toBeGreaterThan(0);
    for (const campaignModule of siteModules) {
      expect(campaignModule.sessions).toHaveLength(5);
    }
    // The PDF pipeline reads the exact same content/pre-rentree-2026/modules.json
    // file directly (no transformation of the module/session counts), so the
    // meaningful parity check is that the site's own derivation doesn't drop
    // or duplicate any module compared to the raw file the PDF reads.
    expect(siteModules.length).toBe(rawModulesDocument.modules.length);
  });

  it('agree on the pack subject-count ceiling (4)', () => {
    expect(MAX_SUBJECTS_PER_PACK).toBe(4);
    expect(pdfPacks.map((pack) => pack.subjectCount).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(Math.max(...pdfPacks.map((pack) => pack.subjectCount))).toBe(MAX_SUBJECTS_PER_PACK);
  });
});
