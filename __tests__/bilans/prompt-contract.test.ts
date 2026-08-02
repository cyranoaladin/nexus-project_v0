import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import entryPack from '@/data/bilans/banks/entree-terminale-maths-v1.json';
import endPack from '@/data/bilans/banks/maths-terminale-bilan-v1.json';

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
const PACKS = [
  ['entrée en Terminale', entryPack],
  ['bilan de fin de Terminale', endPack],
] as const;
type Agent = keyof typeof entryPack.reporting.promptFiles;

function readPrompt(pack: typeof entryPack | typeof endPack, agent: Agent): string {
  return fs.readFileSync(path.join(process.cwd(), pack.reporting.promptFiles[agent].path), 'utf8');
}

describe.each(PACKS)('%s agent prompt contract', (_label, pack) => {
  it.each(Object.keys(pack.reporting.promptFiles) as Agent[])(
    'gives %s a structured reviewable prompt with empty human examples',
    (agent) => {
      const prompt = readPrompt(pack, agent);
      expect(prompt.trim().split('\n').length).toBeGreaterThanOrEqual(20);
      for (const section of COMMON_SECTIONS) expect(prompt).toContain(section);
    },
  );

  it('states the audience contracts and binds every prompt checksum', () => {
    expect(readPrompt(pack, 'preAnalysis')).toContain('Tu ne calcules et ne déduis aucune mesure');
    expect(readPrompt(pack, 'eleve')).toContain('Ce point a l’air acquis mais il ne l’est pas encore');
    expect(readPrompt(pack, 'parents')).toContain('aucune projection de note ou de mention');
    expect(readPrompt(pack, 'nexus')).toContain('Calibration de groupe');
    expect(readPrompt(pack, 'verifier')).toContain('Tu ne corriges et ne réécris aucun texte');
    for (const reference of Object.values(pack.reporting.promptFiles)) {
      const content = fs.readFileSync(path.join(process.cwd(), reference.path), 'utf8');
      expect(createHash('sha256').update(content, 'utf8').digest('hex')).toBe(reference.checksum);
    }
  });
});
