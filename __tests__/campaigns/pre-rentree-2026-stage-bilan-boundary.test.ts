import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  canPrefillBilanGratuitFromPreRentree,
  getPreRentreeReleaseGate,
} from '@/lib/campaigns/pre-rentree-2026/release-gate';
import {
  parsePreRentreeBilanPrefill,
  synchronizePreRentreeCampaignContext,
} from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';

// Deliberately NOT mocking the release gate: this file proves the real,
// currently-deployed contract — the Stage going PUBLIC_READY must never, by
// itself, prefill or collect data on the standalone /bilan-gratuit funnel.

const VALID_PARAMS = {
  programme: 'pre-rentree-2026',
  pack: 'PACK_2',
  niveau: 'PREMIERE',
  matieres: 'MATHEMATIQUES,FRANCAIS',
  voie: 'GENERALE',
  profil_maths: 'MATHS_EDS',
  profil_eaf: 'EAF_GENERALE',
  projet_specialites: 'NSI_PHYSIQUE_CHIMIE',
};

const VALID_CAMPAIGN_CONTEXT = {
  programme: 'pre-rentree-2026' as const,
  packCode: 'PACK_1' as const,
  level: 'SECONDE' as const,
  subjectIds: ['MATHEMATIQUES'] as Array<'MATHEMATIQUES'>,
  profile: {},
};

describe('Stage / Bilan gratuit boundary', () => {
  it('confirms the Stage release is actually PUBLIC_READY in this environment', () => {
    // Sanity check: this suite is only meaningful if it runs against a truly
    // public release. If this ever flips, the decoupling below still holds
    // (prefill stays disabled regardless), but we want visibility on drift.
    expect(getPreRentreeReleaseGate().isPublicReady).toBe(true);
  });

  it('keeps the Bilan prefill integration fail-closed regardless of PUBLIC_READY', () => {
    expect(canPrefillBilanGratuitFromPreRentree()).toBe(false);
  });

  it('never prefills from a fully valid, well-formed campaign query string', () => {
    expect(parsePreRentreeBilanPrefill(VALID_PARAMS)).toBeNull();
  });

  it('never prefills from an absent or empty query string', () => {
    expect(parsePreRentreeBilanPrefill(undefined)).toBeNull();
    expect(parsePreRentreeBilanPrefill({})).toBeNull();
  });

  it('never prefills from an invalid or ambiguous query string', () => {
    expect(parsePreRentreeBilanPrefill({ ...VALID_PARAMS, niveau: 'INCONNU' })).toBeNull();
  });

  it('never re-attaches a campaignContext to a submission, even with a fully valid one', () => {
    expect(
      synchronizePreRentreeCampaignContext({
        campaignContext: VALID_CAMPAIGN_CONTEXT,
        studentGrade: 'seconde',
        subjects: ['MATHEMATIQUES'],
      }),
    ).toBeNull();
  });

  it('carries no nominative or personal fields in the campaign query contract', () => {
    // The query schema is enum-driven (programme/pack/niveau/matieres/profils).
    // There is no name/email/phone field to strip in the first place.
    const forbiddenKeys = ['email', 'phone', 'nom', 'prenom', 'name', 'tel'];
    for (const key of forbiddenKeys) {
      expect(Object.keys(VALID_PARAMS)).not.toContain(key);
    }
  });

  it('does not gate the Bilan prefill call site on isPublicReady in app/bilan-gratuit/page.tsx', () => {
    const page = readFileSync(join(process.cwd(), 'app/bilan-gratuit/page.tsx'), 'utf8');
    expect(page).not.toMatch(/preRentreePublic\s*\?\s*parsePreRentreeBilanPrefill/);
    expect(page).toContain('parsePreRentreeBilanPrefill(params)');
  });

  it('wires the fail-closed gate inside the adapter itself, not only at call sites', () => {
    const adapter = readFileSync(
      join(process.cwd(), 'lib/campaigns/pre-rentree-2026/bilan-prefill.ts'),
      'utf8',
    );
    expect(adapter).toContain('canPrefillBilanGratuitFromPreRentree');
  });
});
