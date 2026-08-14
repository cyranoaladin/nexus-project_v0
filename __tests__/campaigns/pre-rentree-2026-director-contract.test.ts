import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as T;
}

describe('Pré-rentrée 2026 director contract', () => {
  it('keeps offers, capabilities and manual gates in explicit canonical sources', () => {
    const sourcePaths = [
      'content/pre-rentree-2026/offers.json',
      'content/pre-rentree-2026/manuals.registry.json',
      'content/pre-rentree-2026/capabilities.json',
    ];

    expect(sourcePaths.filter((path) => !existsSync(join(root, path)))).toEqual([]);

    const offers = readJson<{
      levels: Array<{
        level: string;
        range: string;
        subjects: string[];
        pricing: { model: string; productIds: string[] };
        capacity: { min: number; max: number };
      }>;
    }>(sourcePaths[0]);
    expect(offers.levels).toHaveLength(5);
    expect(offers.levels.map((offer) => [offer.level, offer.range, offer.subjects.length])).toEqual([
      ['QUATRIEME', 'FONDATIONS', 2],
      ['TROISIEME', 'FONDATIONS', 2],
      ['SECONDE', 'FONDATIONS', 2],
      ['PREMIERE', 'PREMIUM', 5],
      ['TERMINALE', 'PREMIUM', 3],
    ]);
    expect(offers.levels.slice(0, 3).every((offer) => offer.pricing.model === 'PER_SUBJECT' && offer.capacity.max === 6)).toBe(true);
    // La 4e ouvre à 4, pas 3 — exception documentée (mission 4e/Philosophie, §5.1).
    expect(offers.levels.find((offer) => offer.level === 'QUATRIEME')?.capacity.min).toBe(4);
    expect(offers.levels.filter((offer) => offer.level === 'TROISIEME' || offer.level === 'SECONDE')
      .every((offer) => offer.capacity.min === 3)).toBe(true);
    expect(offers.levels.slice(3).every((offer) => (
      offer.pricing.model === 'PACK_BY_SUBJECT_COUNT' && offer.capacity.min === 3 && offer.capacity.max === 5
    ))).toBe(true);

    const manuals = readJson<{ manuals: Array<{
      level: string;
      subject: string;
      printReady: boolean;
      ownerApproved: boolean;
      stockReady: boolean;
    }> }>(sourcePaths[1]).manuals;
    expect(manuals).toHaveLength(4);
    expect(manuals.every((manual) => (
      !manual.printReady && !manual.ownerApproved && !manual.stockReady
    ))).toBe(true);
  });

  it('publishes five entry levels, fourteen modules and seventy sessions', () => {
    const campaign = readJson<{
      levels: Array<{ id: string }>;
      subjects: Array<{ id: string; levels: string[] }>;
    }>('data/campaigns/pre-rentree-2026.json');
    const modules = readJson<{
      modules: Array<{ id: string; level: string; subjectId: string; sessions: unknown[] }>;
    }>('content/pre-rentree-2026/modules.json').modules;

    expect(campaign.levels.map((level) => level.id)).toEqual([
      'QUATRIEME',
      'TROISIEME',
      'SECONDE',
      'PREMIERE',
      'TERMINALE',
    ]);
    expect(modules).toHaveLength(14);
    expect(modules.flatMap((module) => module.sessions)).toHaveLength(70);
    expect(modules.every((module) => module.sessions.length === 5)).toBe(true);
    // Arbitrage du 14/08/2026 : Maths expertes, SVT et Philosophie fermées en
    // Terminale faute d'effectif. Le contrat directeur ne doit plus les publier.
    expect(modules.some((module) => (
      module.level === 'TERMINALE'
      && ['MATHS_EXPERTES', 'PHILOSOPHIE', 'SVT'].includes(module.subjectId)
    ))).toBe(false);
    expect(modules.some((module) => (
      module.level === 'TERMINALE' && module.subjectId === 'FRANCAIS'
    ))).toBe(false);
    expect(modules.some((module) => module.level === 'SECONDE' && module.subjectId !== 'MATHEMATIQUES' && module.subjectId !== 'FRANCAIS')).toBe(false);
    expect(modules.some((module) => module.level === 'QUATRIEME' && module.subjectId !== 'MATHEMATIQUES' && module.subjectId !== 'FRANCAIS')).toBe(false);
  });

  it('uses exact thirty-percent deposits for every Premium pack', () => {
    const packs = readJson<{
      pre_rentree_packs: Array<{
        subjects_count: number;
        price_per_student: number;
        payment: { deposit: number; solde: number };
      }>;
    }>('data/pricing.canonical.json').pre_rentree_packs;

    expect(packs.map((pack) => [
      pack.subjects_count,
      pack.price_per_student,
      pack.payment.deposit,
      pack.payment.solde,
    ])).toEqual([
      [1, 480, 144, 336],
      [2, 900, 270, 630],
      [3, 1_350, 405, 945],
      [4, 1_800, 540, 1_260],
    ]);
    expect(packs.every((pack) => pack.payment.deposit === pack.price_per_student * 0.3)).toBe(true);
    expect(packs.every((pack) => (
      pack.payment.deposit + pack.payment.solde === pack.price_per_student
    ))).toBe(true);
  });

  it('keeps active governance documentation aligned with the 17/85/20/100 taxonomy (mission 4e/Philosophie, 2026-07-27)', () => {
    const documentation = [
      'docs/campaigns/pre-rentree-2026/README.md',
      'docs/campaigns/pre-rentree-2026/SOURCE-OF-TRUTH-MAP.md',
      'docs/campaigns/pre-rentree-2026/PARENT-GUIDE-SOURCE-MAP.md',
      'docs/campaigns/pre-rentree-2026/PARCOURS360-CAPABILITY-MATRIX.md',
      'docs/campaigns/pre-rentree-2026/VALUE-PROOF-MATRIX.md',
      'docs/campaigns/pre-rentree-2026/STAFFING-MATRIX.md',
    ].map((path) => readFileSync(join(root, path), 'utf8')).join('\n');

    expect(documentation).toMatch(/17 modules|dix-sept modules/i);
    expect(documentation).toMatch(/85 séances|quatre-vingt-cinq séances/i);
    expect(documentation).toMatch(/20 cohortes|vingt cohortes/i);
    expect(documentation).toMatch(/100 occurrences|cent occurrences/i);
    expect(documentation).not.toMatch(
      /12 modules|douze modules|16 modules|seize modules|60 séances|soixante séances|80 séances|quatre-vingts séances|\b14 modules\b|quatorze modules|\b70 séances\b|soixante-dix séances|\b17 cohortes\b|dix-sept cohortes/i,
    );
    expect(documentation).toContain('TEACHER_ASSIGNMENTS_VALIDATED=false');
  });
});
