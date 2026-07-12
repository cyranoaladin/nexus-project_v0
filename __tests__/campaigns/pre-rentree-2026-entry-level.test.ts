import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesData from '@/content/pre-rentree-2026/modules.json';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import type { EntryLevelCode } from '@/lib/campaigns/pre-rentree-2026/schema';

const entryLabels = {
  SECONDE: 'Entrée en Seconde',
  PREMIERE: 'Entrée en Première',
  TERMINALE: 'Entrée en Terminale',
} as const;

describe('Pré-rentrée 2026 entry-level invariant', () => {
  it('defines stable level codes as 2026-2027 entry classes', () => {
    expect(campaignManifest.levels).toEqual([
      { id: 'SECONDE', label: entryLabels.SECONDE },
      { id: 'PREMIERE', label: entryLabels.PREMIERE },
      { id: 'TERMINALE', label: entryLabels.TERMINALE },
    ]);
    expect(campaignManifest.entryLevelSemantics).toEqual({
      kind: 'ENTRY_LEVEL',
      schoolYear: '2026-2027',
      currentToEntry: {
        TROISIEME: 'SECONDE',
        SECONDE: 'PREMIERE',
        PREMIERE: 'TERMINALE',
      },
    });
    expect(getPreRentreeLandingDTO().campaign.entryLevelSemantics.kind).toBe('ENTRY_LEVEL');
  });

  it('keeps hero, SEO, FAQ and practical information explicit', () => {
    const dto = getPreRentreeLandingDTO();
    expect(dto.content.hero.subtitle).toContain(
      'élèves entrant en Seconde, Première ou Terminale',
    );
    expect(dto.seo.description).toContain(
      'élèves entrant en Seconde, Première ou Terminale',
    );
    expect(dto.content.practical.audience).toContain(
      'élèves entrant en Seconde, Première ou Terminale',
    );
    expect(JSON.stringify(dto.content.faq)).toContain('entrant en Seconde, Première ou Terminale');
  });

  it('presents every module as preparation for its entry class', () => {
    for (const campaignModule of modulesData.modules) {
      const entryLabel = entryLabels[campaignModule.level as EntryLevelCode];
      expect(`${campaignModule.title} ${campaignModule.subtitle}`).toContain(entryLabel);
      if (campaignModule.level === 'SECONDE') {
        expect(campaignModule.prerequisites).toMatch(/Troisième|collège/i);
        expect(campaignModule.prerequisites).not.toMatch(/programme de Seconde|acquis de Seconde/i);
      }
      if (campaignModule.level === 'PREMIERE') {
        expect(campaignModule.prerequisites).toMatch(/Seconde/i);
        expect(campaignModule.prerequisites).not.toMatch(/acquis de Première|programme de Première/i);
      }
      if (campaignModule.level === 'TERMINALE') {
        expect(campaignModule.prerequisites).toMatch(/Première/i);
        expect(campaignModule.prerequisites).not.toMatch(/acquis de Terminale|programme de Terminale/i);
      }
    }
  });

  it('allows entry-level Première NSI without prior NSI or Python', () => {
    const module = modulesData.modules.find((candidate) => candidate.id === 'premiere-nsi');
    expect(module?.prerequisites).toMatch(/aucun prérequis NSI/i);
    expect(module?.sessions[0]?.title).toMatch(/algorithmique|Python/i);
    expect(module?.sessions[0]?.objective).toMatch(/découvrir|comprendre|écrire/i);
  });

  it('covers the required transition topics without confusing specialties and options', () => {
    const secondeMaths = modulesData.modules.find((candidate) => candidate.id === 'seconde-mathematiques');
    const premiereFrench = modulesData.modules.find((candidate) => candidate.id === 'premiere-francais-eaf');
    const terminaleMaths = modulesData.modules.find((candidate) => candidate.id === 'terminale-mathematiques');
    const terminaleExpression = modulesData.modules.find(
      (candidate) => candidate.id === 'terminale-expression-ecrite-oral',
    );

    expect(JSON.stringify(secondeMaths)).toMatch(/proportionnalité/i);
    expect(premiereFrench?.differentiation).toMatch(/générale ou technologique/i);
    expect(terminaleMaths?.subtitle).toMatch(/EDS Mathématiques/i);
    expect(terminaleMaths?.differentiation).toMatch(
      /Maths expertes et Maths complémentaires sont des options/i,
    );
    expect(terminaleExpression?.title).toBe(
      "Expression écrite, argumentation et maîtrise de l'oral",
    );
  });

  it('targets retained specialties for Terminale NSI and Physics-Chemistry', () => {
    const nsi = modulesData.modules.find((candidate) => candidate.id === 'terminale-nsi');
    const physics = modulesData.modules.find((candidate) => candidate.id === 'terminale-physique-chimie');
    expect(nsi?.subtitle).toMatch(/conservant.*NSI/i);
    expect(nsi?.differentiation).toMatch(/validation pédagogique/i);
    expect(physics?.subtitle).toMatch(/conservant.*Physique-Chimie/i);
    expect(physics?.differentiation).toMatch(/validation pédagogique/i);
  });

  it('locks the public commercial conditions without guaranteeing a place or result', () => {
    const practical = campaignManifest.content.practical;
    const faq = JSON.stringify(campaignManifest.content.faq);
    const publicContract = `${JSON.stringify(practical)} ${faq}`;

    expect(campaignManifest.decisionDeadline).toBe('2026-08-10T18:00:00+01:00');
    expect(practical.preRegistrationNotice).toMatch(/validation administrative et pédagogique/i);
    expect(practical.preRegistrationNotice).toMatch(/acompte/i);
    expect(practical.preRegistrationNotice).toMatch(/ne garantit pas une place/i);
    expect(faq).toMatch(/sans paiement ne bloque pas une place/i);
    expect(practical.groupNotOpenedProcedure).toMatch(/rembourse intégralement/i);
    expect(practical.groupNotOpenedProcedure).toMatch(/sans conversion automatique/i);
    expect(faq).toMatch(/accord écrit/i);
    expect(campaignManifest.featureFlags.enablePayment).toBe(false);
    expect(publicContract).not.toMatch(/résultat scolaire garanti|garantie de résultat/i);
  });
});
