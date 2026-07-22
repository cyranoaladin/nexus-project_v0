import { getPreRentreePublicSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import { getCommercialPublicOffers } from '@/lib/campaigns/pre-rentree-2026/commercial-contract';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const expectedSubjects = {
  TROISIEME: ['FRANCAIS', 'MATHEMATIQUES'],
  SECONDE: ['FRANCAIS', 'MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
  PREMIERE: ['FRANCAIS', 'MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT'],
  TERMINALE: ['MATHEMATIQUES', 'NSI', 'PHILOSOPHIE', 'PHYSIQUE_CHIMIE', 'SVT'],
};

describe('Pré-rentrée 2026 central public-surface adapter', () => {
  it('is the only commercial publication adapter consumed by migrated public routes', () => {
    const files = [
      'app/stages/page.tsx',
      'app/stages/pre-rentree-2026/page.tsx',
      'app/offres/page.tsx',
      'app/accompagnement-scolaire/page.tsx',
      'lib/campaigns/pre-rentree-2026/getters.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).toContain('getPreRentreePublicSurfaceDTO');
      expect(source).not.toContain("from './commercial-contract'");
    }
  });

  it('publishes exactly the approved commercial offers and claims', () => {
    const dto = getPreRentreePublicSurfaceDTO();
    const canonical = getCommercialPublicOffers();

    expect(dto.offers).toHaveLength(13);
    expect(dto.offers.map((offer) => offer.offerId)).toEqual(canonical.map((offer) => offer.offerId));
    for (const offer of dto.offers) {
      const source = canonical.find((item) => item.offerId === offer.offerId);
      expect(source).toBeDefined();
      expect(offer.price).toBe(source?.price);
      expect(offer.deposit).toBe(source?.deposit);
      expect(offer.hours).toBe(source?.hours);
      expect(offer.sessions).toBe(source?.sessions);
      expect(offer.proofIds.length).toBeGreaterThan(0);
      expect(offer.proofIds.every((proofId) => dto.approvedProofIds.includes(proofId))).toBe(true);
    }
  });

  it('derives the only public subjects allowed at each level', () => {
    const dto = getPreRentreePublicSurfaceDTO();
    expect(dto.subjectIdsByLevel).toEqual(expectedSubjects);
    expect(JSON.stringify(dto)).not.toMatch(/SNT/i);
  });

  it('hides services and advantages without approved offer-level evidence', () => {
    const dto = getPreRentreePublicSurfaceDTO();
    const publicCopy = JSON.stringify({
      method: dto.method,
      capabilities: dto.publicCapabilities,
      manuals: dto.publicManuals,
      offeredServices: dto.offers.map((offer) => ({
        objectives: offer.objectives,
        included: offer.included,
        optional: offer.optional,
        supports: offer.supports,
        followUp: offer.followUp,
      })),
      faq: dto.faq,
    });

    expect(dto.publicCapabilities).toEqual([]);
    expect(dto.publicManuals).toEqual([]);
    expect(publicCopy).not.toMatch(/ARIA|Cyclades|manuel offert|remise annuelle|réduction annuelle|enseignants? qualifiés?|bilan parents?|suivi parent/i);
    expect(publicCopy).not.toMatch(/Gate|REVIEW|blocked|owner|placeholder/i);
  });

  it('keeps an unvalidated campaign page out of search indexes', () => {
    const dto = getPreRentreePublicSurfaceDTO();
    expect(dto.publication).toEqual({ sourceStatus: 'DRAFT', indexable: false });
  });

  it('provides complete safe FAQ answers and the canonical contact', () => {
    const dto = getPreRentreePublicSurfaceDTO();
    expect(dto.faq.length).toBeGreaterThanOrEqual(6);
    expect(dto.faq.every((item) => item.question.length > 20 && item.answer.length > 60)).toBe(true);
    expect(dto.contact.whatsappDisplay).toBe('99 192 829');
    expect(dto.contact.whatsappMessage).toContain('pré-rentrée 2026');
    expect(dto.reservation.depositPercentage).toBe(30);
    expect(dto.reservation.rule).toMatch(/sans acompte ne réserve pas la place/i);
  });
});
