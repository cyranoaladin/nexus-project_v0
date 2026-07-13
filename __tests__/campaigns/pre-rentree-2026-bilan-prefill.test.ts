import * as bilanPrefill from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { parsePreRentreeBilanPrefill } from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { resolveSelectedOfferContext } from '@/app/bilan-gratuit/selected-offer';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée bilan prefill parser', () => {
  it('accepts only normalized campaign identifiers', () => {
    const result = parsePreRentreeBilanPrefill({
      programme: 'pre-rentree-2026',
      pack: 'PACK_2',
      niveau: 'PREMIERE',
      matieres: 'MATHEMATIQUES,FRANCAIS',
      voie: 'GENERALE',
      profil_maths: 'MATHS_EDS',
      profil_eaf: 'EAF_GENERALE',
      projet_specialites: 'NSI_PHYSIQUE_CHIMIE',
      price: '1',
      email: 'parent@example.com',
    });

    expect(result).toEqual({
      programme: 'pre-rentree-2026',
      packCode: 'PACK_2',
      level: 'PREMIERE',
      subjectIds: ['MATHEMATIQUES', 'FRANCAIS'],
      profile: {
        voie: 'GENERALE',
        mathsProfile: 'MATHS_EDS',
        eafProfile: 'EAF_GENERALE',
        premiereSpecialtyPlan: 'NSI_PHYSIQUE_CHIMIE',
      },
    });
    expect(result).not.toHaveProperty('price');
    expect(result).not.toHaveProperty('email');
  });

  it.each([
    { programme: 'other', pack: 'PACK_1', niveau: 'SECONDE', matieres: 'FRANCAIS' },
    { programme: 'pre-rentree-2026', pack: 'unknown', niveau: 'SECONDE', matieres: 'FRANCAIS' },
    { programme: 'pre-rentree-2026', pack: 'PACK_1', niveau: 'AUTRE', matieres: 'FRANCAIS' },
    { programme: 'pre-rentree-2026', pack: 'PACK_1', niveau: 'SECONDE', matieres: 'AUTRE' },
    { programme: 'pre-rentree-2026', pack: 'PACK_4', niveau: 'SECONDE', matieres: 'MATHEMATIQUES,FRANCAIS,NSI,PHYSIQUE_CHIMIE,AUTRE' },
    { programme: 'pre-rentree-2026', pack: 'PACK_1', niveau: 'PREMIERE', matieres: 'FRANCAIS', voie: 'GENERALE', profil_maths: 'MATHS_EDS' },
    { programme: 'pre-rentree-2026', pack: 'PACK_1', niveau: 'TERMINALE', matieres: 'MATHEMATIQUES', voie: 'GENERALE', option_maths: 'AUCUNE' },
  ])('rejects invalid or oversized values: %#', (params) => {
    expect(parsePreRentreeBilanPrefill(params)).toBeNull();
  });

  it('deduplicates subjects and rejects a pack count mismatch', () => {
    expect(
      parsePreRentreeBilanPrefill({
        programme: 'pre-rentree-2026',
        pack: 'PACK_2',
        niveau: 'SECONDE',
        matieres: 'FRANCAIS,FRANCAIS',
      }),
    ).toBeNull();
  });

  it('resolves the selected pack price only from the canonical catalogue', () => {
    const pack = getPreRentreeLandingDTO().packs[1];
    expect(resolveSelectedOfferContext('PACK_2')).toEqual({
      id: 'PACK_2',
      title: expect.stringContaining('Pré-Rentrée 2026'),
      price: pack.price,
      deposit: pack.deposit,
      solde: pack.balance,
    });
  });

  it('rebuilds the campaign context from the submitted grade and subjects', () => {
    type ContextSynchronizer = (input: {
      campaignContext: {
        programme: 'pre-rentree-2026';
        packCode: 'PACK_1' | 'PACK_2' | 'PACK_3' | 'PACK_4';
        level: 'SECONDE' | 'PREMIERE' | 'TERMINALE';
        subjectIds: Array<'MATHEMATIQUES' | 'PHYSIQUE_CHIMIE' | 'NSI' | 'FRANCAIS'>;
        profile: Record<string, unknown>;
      };
      studentGrade: string;
      subjects: string[];
    }) => unknown;
    const synchronize = (bilanPrefill as unknown as {
      synchronizePreRentreeCampaignContext?: ContextSynchronizer;
    }).synchronizePreRentreeCampaignContext;

    expect(synchronize).toBeDefined();
    if (!synchronize) return;

    const initial = {
      programme: 'pre-rentree-2026' as const,
      packCode: 'PACK_1' as const,
      level: 'SECONDE' as const,
      subjectIds: ['MATHEMATIQUES'] as Array<'MATHEMATIQUES'>,
      profile: {},
    };

    for (const subjectIds of [
      ['MATHEMATIQUES'],
      ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE'],
      ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'FRANCAIS'],
      ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'FRANCAIS', 'NSI'],
    ]) {
      expect(synchronize({
        campaignContext: initial,
        studentGrade: 'seconde',
        subjects: subjectIds,
      })).toEqual({
        programme: 'pre-rentree-2026',
        packCode: `PACK_${subjectIds.length}`,
        level: 'SECONDE',
        subjectIds,
        profile: {},
      });
    }

    expect(synchronize({
      campaignContext: initial,
      studentGrade: 'premiere',
      subjects: ['MATHEMATIQUES'],
    })).toBeNull();
  });
});
