import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import { getCommercialPublicOffers } from '@/lib/campaigns/pre-rentree-2026/commercial-contract';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// NOTE (pré-rentrée 2026, modèle fenêtres + week-end v2) : le planning et le catalogue de
// modules (data/campaigns/pre-rentree-2026.json, content/pre-rentree-2026/modules.json,
// offers.json) sont alignés sur la grille — Seconde n'a plus de séance NSI/SNT ni
// Physique-Chimie, Terminale a Maths expertes au lieu de Philosophie.
// Arbitrage direction du 2026-07-24 (définitif) : pour les stages de pré-rentrée, la
// Seconde = Mathématiques + Français uniquement (grille du 24/07 fait foi).
// content/pre-rentree-2026/commercial-contract.fr.json a été réconcilié en conséquence :
// les 2 SKU Seconde Physique-Chimie / Informatique-SNT (approuvés le 2026-07-20) ont été
// retirés après vérification qu'il s'agissait bien de SKU de STAGE (même pricingId
// pre2026-foundations-seconde-subject que Maths/Français) et non d'une contamination
// annuelle. Voir SEPARATION_STAGES_ANNUEL.md et DEBTS.md.
const expectedSubjects = {
  TROISIEME: ['FRANCAIS', 'MATHEMATIQUES'],
  SECONDE: ['FRANCAIS', 'MATHEMATIQUES'],
  PREMIERE: ['FRANCAIS', 'MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT'],
  TERMINALE: ['MATHEMATIQUES', 'MATHS_EXPERTES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT'],
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
    const dto = compilePreRentreeReviewSurfaceDTO();
    const canonical = getCommercialPublicOffers();

    expect(dto.offers).toHaveLength(12);
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
    const dto = compilePreRentreeReviewSurfaceDTO();
    expect(dto.subjectIdsByLevel).toEqual(expectedSubjects);
    const secondeSubjects = dto.levels.find((level) => level.id === 'SECONDE')!.subjects;
    expect(secondeSubjects.map((subject) => subject.id).sort()).toEqual(['FRANCAIS', 'MATHEMATIQUES']);
  });

  it('exposes a sanitized planning/program/document DTO with canonical counts', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    expect(dto.planning.metrics).toEqual({
      pedagogicalModuleCount: 14,
      pedagogicalSessionTemplateCount: 70,
      operationalCohortCount: 17,
      scheduledSessionOccurrenceCount: 85,
      studentSessionsPerSubject: 5,
      studentHoursPerSubject: 10,
    });
    expect(dto.planning.schedule).toHaveLength(85);
    expect(dto.programs).toHaveLength(14);
    expect(dto.documents).toHaveLength(7);
    expect(dto.planning.roomsPubliclyConfirmed).toBe(false);
    expect(dto.planning.schedule.every((slot) => slot.room === undefined)).toBe(true);
    expect(dto.planning.scheduleWindows.every(
      (window) => window.slots.every((slot) => slot.room === undefined),
    )).toBe(true);
    const publicPlanningPayload = JSON.stringify(dto.planning);
    expect(publicPlanningPayload).not.toMatch(
      /teacherRole|TEACHER_|alternativeGroupId|publication_authorization|roomAssignmentsValidated|salle-\d/i,
    );
  });

  it('hides services and advantages without approved offer-level evidence', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
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

  it('synthesizes Fondations offerOptions for every subject count — non-régression du bug « Volume 0 h »', () => {
    // Le contrat commercial ne déclare qu'UNE seule offre par niveau Fondations
    // (subjectCount implicite = 1) : sans synthèse, sélectionner 2+ matières en
    // 3e/Seconde ne trouvait aucune entrée d'offre et affichait "Volume 0 h".
    const dto = compilePreRentreeReviewSurfaceDTO();
    const unitByLevel: Record<string, { hours: number; price: number }> = {};
    for (const offer of dto.offers) {
      if (offer.level === 'TROISIEME' || offer.level === 'SECONDE') {
        unitByLevel[offer.level] = { hours: offer.hours, price: offer.price };
      }
    }
    expect(Object.keys(unitByLevel).sort()).toEqual(['SECONDE', 'TROISIEME']);

    for (const level of ['TROISIEME', 'SECONDE'] as const) {
      const unit = unitByLevel[level]!;
      const twoSubjectsOption = dto.planning.offerOptions.find(
        (option) => option.level === level && option.subjectsCount === 2,
      );
      expect(twoSubjectsOption).toBeDefined();
      expect(twoSubjectsOption?.totalHours).toBe(unit.hours * 2);
      expect(twoSubjectsOption?.price).toBe(unit.price * 2);
    }
  });

  it('marks the informational campaign content as indexable once the release gate opens', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    expect(dto.publication).toEqual({ sourceStatus: 'PUBLIC_INFORMATIONAL', indexable: true });
  });

  it('retires the obsolete standalone JPO page and its middleware exception', () => {
    expect(existsSync(join(process.cwd(), 'portes_ouvertes.html'))).toBe(false);
    const middleware = readFileSync(join(process.cwd(), 'middleware.ts'), 'utf8');
    expect(middleware).not.toContain('portes_ouvertes');
  });

  it('provides complete safe FAQ answers and the canonical contact', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    expect(dto.faq.length).toBeGreaterThanOrEqual(6);
    expect(dto.faq.every((item) => item.question.length > 20 && item.answer.length > 60)).toBe(true);
    expect(dto.contact.whatsappDisplay).toBe('99 192 829');
    expect(dto.contact.whatsappMessage).toContain('pré-rentrée 2026');
    expect(dto.contact.phoneDisplay).toBe('+216 99 19 28 29');
    expect(dto.contact.phoneHref).toBe('tel:+21699192829');
    expect(dto.reservation.depositPercentage).toBe(30);
    expect(dto.reservation.enabled).toBe(false);
    expect(dto.reservation.rule).toMatch(/n.engage aucun paiement/i);
  });
});
