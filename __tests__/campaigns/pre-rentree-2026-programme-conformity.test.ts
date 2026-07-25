import campaign from '@/data/campaigns/pre-rentree-2026.json';
import modulesSource from '@/content/pre-rentree-2026/modules.json';
import programmeMatrix from '@/content/pre-rentree-2026/official-programme-matrix.fr.json';
import { PreRentreeModulesSchema } from '@/lib/campaigns/pre-rentree-2026/schema';

const parsedModules = PreRentreeModulesSchema.parse(modulesSource);

const moduleById = (id: string) => {
  const module = parsedModules.modules.find((candidate) => candidate.id === id);
  if (!module) throw new Error(`Missing module ${id}`);
  return module;
};

describe('Pré-rentrée 2026 official-programme conformity proposals', () => {
  it('keeps every officialProgrammeId referenced in rows[] defined in officialSources[] (referential completeness)', () => {
    const definedIds = new Set(programmeMatrix.officialSources.map((source) => source.officialProgrammeId));
    const missing = programmeMatrix.rows
      .filter((row) => !definedIds.has(row.officialProgrammeId))
      .map((row) => ({ moduleId: row.moduleId, officialProgrammeId: row.officialProgrammeId }));
    expect(missing).toEqual([]);
  });

  it('keeps revised Maths modules non-public until pedagogical validation', () => {
    expect(() => PreRentreeModulesSchema.parse(modulesSource)).not.toThrow();

    for (const id of ['seconde-mathematiques', 'premiere-mathematiques']) {
      expect(moduleById(id).publicationStatus).toBe('PROPOSAL_PENDING_PEDAGOGICAL_VALIDATION');
      expect(programmeMatrix.rows.find((row) => row.moduleId === id)?.publicOfferEligible).toBe(false);
    }
  });

  it('covers the verified Seconde 2026 deltas without moving the discriminant to Seconde', () => {
    const copy = JSON.stringify(moduleById('seconde-mathematiques'));
    expect(copy).toMatch(/valeur absolue/i);
    expect(copy).toMatch(/série continue|regroupée en classes/i);
    expect(copy).toMatch(/variables qualitatives/i);
    expect(copy).toMatch(/probabilité conditionnelle/i);
    expect(copy).not.toMatch(/discriminant/i);
  });

  it('keeps discriminant, exponential, produit scalaire and trigonométrie in Première spécialité (recentrage 2026-07-25)', () => {
    // Correction pédagogique validée direction (2026-07-25) : le module premiere-mathematiques
    // vise la spécialité Mathématiques (Nexus ne propose que l'EDS spé en Première), pas le
    // tronc commun. Séance 4 (ex. probabilités conditionnelles) -> produit scalaire ; séance 5
    // (ex. automatismes génériques) -> trigonométrie + méthode épreuve anticipée de spécialité.
    const module = moduleById('premiere-mathematiques');
    const copy = JSON.stringify(module);
    expect(copy).toMatch(/discriminant/i);
    expect(copy).toMatch(/fonction exponentielle/i);
    expect(copy).toMatch(/épreuve.*anticipée.*spécialité|épreuve terminale anticipée/i);
    expect(copy).toMatch(/produit scalaire/i);
    expect(copy).toMatch(/trigonométrie|cercle trigonométrique/i);
    expect(copy).toMatch(/fonctions cosinus et sinus|cosinus.*sinus/i);
    expect(copy).not.toMatch(/probabilités conditionnelles/i);
  });

  it('keeps both SVT modules in DRAFT with three-theme coverage and exact equipment wording', () => {
    const expectedEquipment = "Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant.";
    for (const id of ['premiere-svt', 'terminale-svt']) {
      const module = moduleById(id);
      expect(module.publicationStatus).toBe('DRAFT_PENDING_QUALIFIED_TEACHER_VALIDATION');
      expect(module.equipment).toBe(expectedEquipment);
      expect(programmeMatrix.rows.find((row) => row.moduleId === id)?.publicOfferEligible).toBe(false);
      expect(JSON.stringify(module.sessions)).toMatch(/Terre|génétique|géologique/i);
      expect(JSON.stringify(module.sessions)).toMatch(/écosystème|climat|plantes/i);
      expect(JSON.stringify(module.sessions)).toMatch(/santé|immunité|mouvement|stress/i);
    }
  });

  it('states the official anticipated Maths exam in the FAQ without a result promise', () => {
    const faq = campaign.content.faq.find((item) => /épreuve de mathématiques en fin de Première/i.test(item.question));
    expect(faq?.answer).toMatch(/épreuve terminale anticipée/i);
    expect(faq?.answer).toMatch(/ne promet ni couverture du programme annuel ni résultat/i);
  });

  it('does not name a changing annual work in the Première French module', () => {
    const copy = JSON.stringify(moduleById('premiere-francais-eaf'));
    expect(copy).not.toMatch(/Le Chevalier de la charrette|Pot-Bouille|Thérèse Raquin|Télumée Miracle/i);
  });
});
