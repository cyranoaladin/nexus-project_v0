import { parsePreRentreeBilanPrefill } from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { resolveSelectedOfferContext } from '@/app/bilan-gratuit/selected-offer';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée bilan prefill parser', () => {
  it('accepts only normalized campaign identifiers', () => {
    const result = parsePreRentreeBilanPrefill({
      programme: 'pre-rentree-2026',
      pack: 'pre2026-pack-2',
      niveau: 'PREMIERE',
      matieres: 'MATHEMATIQUES,FRANCAIS',
      voie: 'GENERALE',
      profil_maths: 'MATHS_EDS',
      profil_eaf: 'EAF_GENERALE',
      price: '1',
      email: 'parent@example.com',
    });

    expect(result).toEqual({
      programme: 'pre-rentree-2026',
      packId: 'pre2026-pack-2',
      level: 'PREMIERE',
      subjectIds: ['MATHEMATIQUES', 'FRANCAIS'],
      profile: {
        voie: 'GENERALE',
        mathsProfile: 'MATHS_EDS',
        eafProfile: 'EAF_GENERALE',
      },
    });
    expect(result).not.toHaveProperty('price');
    expect(result).not.toHaveProperty('email');
  });

  it.each([
    { programme: 'other', pack: 'pre2026-pack-1', niveau: 'SECONDE', matieres: 'FRANCAIS' },
    { programme: 'pre-rentree-2026', pack: 'unknown', niveau: 'SECONDE', matieres: 'FRANCAIS' },
    { programme: 'pre-rentree-2026', pack: 'pre2026-pack-1', niveau: 'AUTRE', matieres: 'FRANCAIS' },
    { programme: 'pre-rentree-2026', pack: 'pre2026-pack-1', niveau: 'SECONDE', matieres: 'AUTRE' },
    { programme: 'pre-rentree-2026', pack: 'pre2026-pack-4', niveau: 'SECONDE', matieres: 'MATHEMATIQUES,FRANCAIS,NSI,PHYSIQUE_CHIMIE,AUTRE' },
  ])('rejects invalid or oversized values: %#', (params) => {
    expect(parsePreRentreeBilanPrefill(params)).toBeNull();
  });

  it('deduplicates subjects and rejects a pack count mismatch', () => {
    expect(
      parsePreRentreeBilanPrefill({
        programme: 'pre-rentree-2026',
        pack: 'pre2026-pack-2',
        niveau: 'SECONDE',
        matieres: 'FRANCAIS,FRANCAIS',
      }),
    ).toBeNull();
  });

  it('resolves the selected pack price only from the canonical catalogue', () => {
    const pack = getPreRentreeLandingDTO().packs[1];
    expect(resolveSelectedOfferContext(pack.id)).toEqual({
      id: pack.id,
      title: expect.stringContaining('Pré-Rentrée 2026'),
      price: pack.price,
      deposit: pack.deposit,
      solde: pack.balance,
    });
  });
});
