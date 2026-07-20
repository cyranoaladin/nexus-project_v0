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
    expect(offers.levels).toHaveLength(4);
    expect(offers.levels.map((offer) => [offer.level, offer.range, offer.subjects.length])).toEqual([
      ['TROISIEME', 'FONDATIONS', 2],
      ['SECONDE', 'FONDATIONS', 4],
      ['PREMIERE', 'PREMIUM', 4],
      ['TERMINALE', 'PREMIUM', 4],
    ]);
    expect(offers.levels.slice(0, 2).every((offer) => (
      offer.pricing.model === 'PER_SUBJECT' && offer.capacity.min === 4 && offer.capacity.max === 6
    ))).toBe(true);
    expect(offers.levels.slice(2).every((offer) => (
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

  it('publishes four entry levels, fourteen modules and seventy sessions', () => {
    const campaign = readJson<{
      levels: Array<{ id: string }>;
      subjects: Array<{ id: string; levels: string[] }>;
    }>('data/campaigns/pre-rentree-2026.json');
    const modules = readJson<{
      modules: Array<{ id: string; level: string; subjectId: string; sessions: unknown[] }>;
    }>('content/pre-rentree-2026/modules.json').modules;

    expect(campaign.levels.map((level) => level.id)).toEqual([
      'TROISIEME',
      'SECONDE',
      'PREMIERE',
      'TERMINALE',
    ]);
    expect(modules).toHaveLength(14);
    expect(modules.flatMap((module) => module.sessions)).toHaveLength(70);
    expect(modules.every((module) => module.sessions.length === 5)).toBe(true);
    expect(modules).toContainEqual(expect.objectContaining({
      id: 'seconde-informatique-snt',
      subjectId: 'NSI',
    }));
    expect(modules).toContainEqual(expect.objectContaining({
      id: 'terminale-philosophie',
      subjectId: 'PHILOSOPHIE',
    }));
    expect(modules.some((module) => (
      module.level === 'TERMINALE' && module.subjectId === 'FRANCAIS'
    ))).toBe(false);
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
});
