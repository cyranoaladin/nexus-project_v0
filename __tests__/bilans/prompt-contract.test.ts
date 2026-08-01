import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import pack from '@/data/bilans/banks/maths-terminale-v1.json';

const COMMON_SECTIONS = [
  '## Rôle',
  '## Entrées',
  '## Règles absolues',
  '## Sortie',
  '## Exemples à compléter par le responsable pédagogique',
  '### Bonne formulation',
  '### Mauvaise formulation',
  'À COMPLÉTER PAR LE RESPONSABLE PÉDAGOGIQUE',
] as const;

function readPrompt(agent: keyof typeof pack.reporting.promptFiles): string {
  return fs.readFileSync(path.join(process.cwd(), pack.reporting.promptFiles[agent].path), 'utf8');
}

describe('maths Terminale agent prompt contract', () => {
  it.each(Object.keys(pack.reporting.promptFiles) as Array<keyof typeof pack.reporting.promptFiles>)(
    'gives %s a structured reviewable prompt with empty human examples',
    (agent) => {
      const prompt = readPrompt(agent);
      expect(prompt.trim().split('\n').length).toBeGreaterThanOrEqual(20);
      for (const section of COMMON_SECTIONS) expect(prompt).toContain(section);
    },
  );

  it('states the pre-analysis boundary without deriving facts or measures', () => {
    const prompt = readPrompt('preAnalysis');
    expect(prompt).toContain('forcesPercues');
    expect(prompt).toContain('craintes');
    expect(prompt).toContain('Tu ne calcules et ne déduis aucune mesure');
    expect(prompt).toContain('pseudonymisées');
  });

  it('states the student rendering contract and the mandated ERREUR_CONFIANTE wording', () => {
    const prompt = readPrompt('eleve');
    expect(prompt).toContain('Ce point a l’air acquis mais il ne l’est pas encore — c’est exactement le type d’écart qui coûte cher en devoir surveillé.');
    expect(prompt).toContain('tu étais sûr et tu t’es trompé');
    expect(prompt).toContain('globalScore');
    expect(prompt).toContain('groupBand');
    expect(prompt).toContain('shortCorrection');
  });

  it('makes the eight parent rules explicit', () => {
    const prompt = readPrompt('parents');
    for (let rule = 1; rule <= 8; rule += 1) expect(prompt).toContain(`${rule}.`);
    expect(prompt).toContain('COUVERTURE_INSUFFISANTE');
    expect(prompt).toContain('PASSATION_EXPRESS');
    expect(prompt).toContain('Être conseillé');
    expect(prompt).toContain('aucune projection de note ou de mention');
  });

  it('states the complete internal Nexus scope', () => {
    const prompt = readPrompt('nexus');
    for (const fact of ['globalScore', 'calibrationIndex', 'coverage', 'groupBand', 'engineVersion', 'testVersion']) {
      expect(prompt).toContain(fact);
    }
    expect(prompt).toContain('Calibration de groupe');
    expect(prompt).toContain('Points de vigilance opérationnels');
  });

  it('requires the verifier to compare all reports to the FactSheet without rewriting', () => {
    const prompt = readPrompt('verifier');
    expect(prompt).toContain('les trois restitutions');
    expect(prompt).toContain('FactSheet');
    expect(prompt).toContain('Tu ne corriges et ne réécris aucun texte');
    expect(prompt).toContain('violations');
  });

  it('binds every prompt byte-for-byte to the checksum declared by the pack', () => {
    for (const reference of Object.values(pack.reporting.promptFiles)) {
      const content = fs.readFileSync(path.join(process.cwd(), reference.path), 'utf8');
      expect(createHash('sha256').update(content, 'utf8').digest('hex')).toBe(reference.checksum);
    }
  });
});
