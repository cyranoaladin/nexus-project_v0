import { ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';

const identity: RenderIdentity = {
  displayName: 'ELEVE_A',
  level: 'TROISIEME',
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: 'Stage de pré-rentrée — Entrée en 3e, Mathématiques',
};

describe('A90.2 deterministic HTML reports', () => {
  it('is byte-stable and uses only configured brand assets and lux tokens', () => {
    const first = renderDeterministicBilanHtml(ENTRY_RECIPE_FACT_SHEETS[0], 'ELEVE', identity);
    const second = renderDeterministicBilanHtml(ENTRY_RECIPE_FACT_SHEETS[0], 'ELEVE', identity);

    expect(first).toBe(second);
    expect(first).toContain('<!doctype html>');
    expect(first).toContain('data-audience="ELEVE"');
    expect(first).toContain('/images/logo_slogan_nexus_x3.png');
    expect(first).toContain('/images/logo_nexus_reussite.png');
    expect(first).toContain('var(--color-lux-ink)');
    expect(first).toContain('var(--font-fraunces)');
    expect(first).toContain('var(--font-dm-sans)');
    expect(first).toContain('@page');
    expect(first).toContain('size: A4');
  });

  it('renders the student mastery map, ordered priorities, path and closing message without scores', () => {
    const html = renderDeterministicBilanHtml(ENTRY_RECIPE_FACT_SHEETS[0], 'ELEVE', identity);

    expect(html).toContain('Ta carte maîtrise × confiance');
    expect(html).toContain('Tes priorités pour le stage');
    expect(html).toContain('Ton parcours pendant le stage');
    expect(html).toContain('Ton plan d’action');
    expect(html).toContain('Pour finir');
    expect(html).not.toMatch(/globalScore|domainScores|calibrationIndex|\bscore\b/i);
  });

  it('renders the complete parent path without referral CTA or scores', () => {
    const html = renderDeterministicBilanHtml(ENTRY_RECIPE_FACT_SHEETS[0], 'PARENTS', identity);

    expect(html).toContain('Le parcours de votre enfant pendant le stage');
    expect(html).toContain('Séance 1');
    expect(html).toContain('Objectif');
    expect(html).toContain('Démarche');
    expect(html).not.toContain('Être conseillé');
    expect(html).not.toContain('Un échange');
    expect(html).not.toMatch(/globalScore|domainScores|calibrationIndex|\bscore\b/i);
  });

  it('renders Nexus internal facts, domain table, four-week plan and alerts', () => {
    const html = renderDeterministicBilanHtml(ENTRY_RECIPE_FACT_SHEETS[0], 'NEXUS', identity);

    expect(html).toContain('Données internes');
    expect(html).toContain('Tableau des domaines');
    expect(html).toContain('Plan sur 4 semaines');
    expect(html).toContain('Alertes pédagogiques');
    expect(html).toContain('Score global');
    expect(html).toContain('ERREUR_CONFIANTE');
  });

  it('uses aptitude terminology for philosophy through configuration', () => {
    const html = renderDeterministicBilanHtml(ENTRY_RECIPE_FACT_SHEETS[0], 'NEXUS', {
      ...identity,
      subject: 'PHILOSOPHIE',
      stageLabel: 'Stage de pré-rentrée — Entrée en Terminale, Philosophie',
    });

    expect(html).toContain('Tableau des aptitudes');
    expect(html).not.toContain('score de maîtrise');
  });
});
