import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { POO_ACTIVITY_SLUG, getPooContent, getPooRequiredSteps } from '@/lib/espace/catalog';

const CONTENT_PATH = path.join(process.cwd(), 'content/espace/nsi-poo/content.json');

describe('contenu du TP POO — conservation du contenu pédagogique', () => {
  it('est identique octet pour octet au content.json du système historique archivé', () => {
    // Empreinte du content.json déployé le 2026-09-26 (archive legacy du 2026-10-02).
    const sha = createHash('sha256').update(readFileSync(CONTENT_PATH)).digest('hex');
    expect(sha).toBe('217af365a1a31111554ac680d32e8be63d7d4c42e7395d30824441906c112771');
  });

  it('garde la structure annoncée : 7 étapes obligatoires + 1 bonus facultatif, 120 minutes', () => {
    const c = getPooContent();
    expect(c.title).toBe('Des objets qui agissent');
    expect(c.duration).toBe(120);
    expect(c.steps).toHaveLength(8);
    expect(getPooRequiredSteps()).toHaveLength(7);
    expect(c.steps[7].id).toBe('bonus');
    expect(getPooRequiredSteps().reduce((n, s) => n + s.minutes, 0)).toBe(120);
  });

  it("l'activité POO a un slug stable", () => {
    expect(POO_ACTIVITY_SLUG).toBe('nsi-poo-objets-qui-agissent');
  });

  it('chaque question a une bonne réponse située dans ses choix, et des identifiants uniques par étape', () => {
    for (const step of getPooContent().steps) {
      const qids = step.questions.map((q) => q.id);
      expect(new Set(qids).size).toBe(qids.length);
      for (const q of step.questions) {
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.correct).toBeGreaterThanOrEqual(0);
        expect(q.correct).toBeLessThan(q.choices.length);
      }
      const fids = step.fields.map((f) => f.id);
      expect(new Set(fids).size).toBe(fids.length);
    }
  });

  it('les identifiants d’étape sont uniques', () => {
    const ids = getPooContent().steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('le HTML de leçon (rendu tel quel) ne contient ni script, ni gestionnaire d’événement, ni iframe', () => {
    for (const step of getPooContent().steps) {
      const html = step.lesson + step.intro;
      expect(html).not.toMatch(/<\s*script/i);
      expect(html).not.toMatch(/<\s*iframe/i);
      expect(html).not.toMatch(/\son[a-z]+\s*=/i);
      expect(html).not.toMatch(/javascript:/i);
    }
  });
});
