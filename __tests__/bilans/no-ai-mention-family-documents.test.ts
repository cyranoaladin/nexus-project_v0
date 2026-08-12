import fs from 'node:fs';
import path from 'node:path';

import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import { ENTRY_RECIPE_FACT_SHEETS, PREMIERE_ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

/**
 * Consigne du responsable : les bilans élève et parents sont entièrement
 * déterministes — AUCUNE mention d'IA, de LLM ou d'outil de génération ne
 * doit y figurer. Les mentions RGPD validées vivent dans la notice de
 * confidentialité, pas dans les documents remis aux familles.
 */

const AI_MENTIONS = /intelligence artificielle|\bIA\b|\bLLM\b|générative|génératif|OpenRouter|Claude|GPT|Sonnet|assistant de rédaction|outil d(e|’|')aide à la rédaction/i;

const identity: RenderIdentity = {
  displayName: 'ELEVE_MENTIONS',
  level: 'PREMIERE',
  subject: 'MATHS',
  date: '2026-08-12',
  stageLabel: buildPreRentreeStageLabel('PREMIERE', 'MATHS'),
};

describe('Aucune mention d’IA dans les documents familles', () => {
  it.each(['ELEVE', 'PARENTS'] as const)('le document %s rendu n’en contient aucune', (audience) => {
    for (const factSheet of [PREMIERE_ENTRY_RECIPE_FACT_SHEETS[0], ENTRY_RECIPE_FACT_SHEETS[0]]) {
      const html = renderDeterministicBilanHtml(factSheet, audience, identity);
      const visible = html.replace(/<style>[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
      expect(visible).not.toMatch(AI_MENTIONS);
    }
  });

  it('les catalogues de prose déterministes n’en contiennent aucune non plus', () => {
    for (const file of [
      'lib/bilans/render/profile-copy.ts',
      'lib/bilans/render/report.ts',
      'lib/bilans/render/learning-path.ts',
      'lib/bilans/render/prose-catalogue.ts',
      'lib/bilans/staff/whatsapp-message.ts',
      'lib/bilans/staff/parent-notification.ts',
    ]) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      // On ne vérifie que les littéraux de chaînes françaises destinés aux
      // familles : les identifiants techniques/commentaires sont hors champ.
      const strings = [...source.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)]
        .map((match) => match[1] ?? match[2] ?? '');
      for (const literal of strings) {
        if (literal.length < 15) continue;
        expect(literal).not.toMatch(AI_MENTIONS);
      }
    }
  });

  it('la notice de confidentialité porte, elle, les deux mentions validées verbatim', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/politique-confidentialite/page.tsx'), 'utf8');
    expect(source).toContain('le bilan de votre enfant peut vous être transmis par WhatsApp');
    expect(source).toContain('valable trente jours');
    expect(source).toContain('Le diagnostic repose sur un barème déterministe');
    expect(source).toContain('nous nous appuyons sur un outil d’aide à la rédaction');
    expect(source).toContain('le prénom et le nom de votre enfant ne sont jamais');
  });
});
