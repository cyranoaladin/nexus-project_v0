import {
  formatCampaignStatus,
  formatCampaignVenue,
  formatFrenchDecisionDate,
  formatPresenceRange,
  formatWeekRange,
} from '@/lib/campaigns/pre-rentree-2026/presentation';
import {
  SUBJECT_THEMES,
  getSubjectTheme,
} from '@/lib/campaigns/pre-rentree-2026/subject-theme';

describe('Pré-rentrée 2026 public presentation contracts', () => {
  it('humanizes the technical status without leaking the enum', () => {
    expect(formatCampaignStatus('PRE_REGISTRATION_OPEN')).toBe('Pré-inscriptions ouvertes');
    expect(formatCampaignStatus('PRE_REGISTRATION_OPEN')).not.toContain('PRE_REGISTRATION_OPEN');
  });

  it('formats the decision deadline with a French 24-hour clock', () => {
    const value = formatFrenchDecisionDate('2026-08-10T18:00:00+01:00');
    expect(value).toBe('10 août 2026 à 18 h 00');
    expect(value).not.toMatch(/06:00 PM|PM|AM/);
  });

  it('deduplicates the pedagogical venue', () => {
    expect(formatCampaignVenue({
      name: 'Nexus Réussite — Mutuelleville',
      neighborhood: 'Mutuelleville',
      city: 'Tunis',
    })).toBe('Nexus Réussite — Mutuelleville, Tunis');
  });

  it('condenses week and presence ranges while preserving real dates', () => {
    expect(formatWeekRange('2026-08-17', '2026-08-21')).toBe('17–21 août');
    expect(formatPresenceRange(['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21']))
      .toBe('Du lundi 17 au vendredi 21 août');
  });

  it('defines exactly seven accessible subject families, strictly limited to stage subjects', () => {
    expect(Object.keys(SUBJECT_THEMES)).toEqual([
      'MATHEMATIQUES',
      'FRANCAIS',
      'NSI',
      'PHYSIQUE_CHIMIE',
      'SVT',
      'MATHS_EXPERTES',
      'PHILOSOPHIE',
    ]);
    for (const theme of Object.values(SUBJECT_THEMES)) {
      expect(theme.label).toEqual(expect.any(String));
      expect(theme.marker).toEqual(expect.any(String));
      expect(theme.surfaceClass).toMatch(/bg-/);
      expect(theme.borderClass).toMatch(/border-/);
      expect(theme.textClass).toMatch(/text-/);
      expect(theme.printClass).toMatch(/print:/);
    }
    // Violet reste réservé à ARIA (NSI l'utilise déjà, antérieur à cette
    // règle, hors périmètre) : toute NOUVELLE famille doit l'éviter.
    expect(SUBJECT_THEMES.PHILOSOPHIE.surfaceClass).not.toMatch(/violet/);
    expect(SUBJECT_THEMES.PHILOSOPHIE.borderClass).not.toMatch(/violet/);
    expect(SUBJECT_THEMES.PHILOSOPHIE.textClass).not.toMatch(/violet/);
    expect(SUBJECT_THEMES.PHILOSOPHIE.markerClass).not.toMatch(/violet/);
  });

  it('maps French/Expression and NSI variants to their families', () => {
    expect(getSubjectTheme('FRANCAIS', 'Français')).toBe(SUBJECT_THEMES.FRANCAIS);
    expect(getSubjectTheme('FRANCAIS', 'Français — EAF')).toBe(SUBJECT_THEMES.FRANCAIS);
    expect(getSubjectTheme('FRANCAIS', 'Expression écrite, argumentation et maîtrise de l’oral'))
      .toBe(SUBJECT_THEMES.FRANCAIS);
    expect(getSubjectTheme('NSI', 'NSI')).toBe(SUBJECT_THEMES.NSI);
    expect(getSubjectTheme('NSI', 'Numérique et sciences informatiques'))
      .toBe(SUBJECT_THEMES.NSI);
  });
});
