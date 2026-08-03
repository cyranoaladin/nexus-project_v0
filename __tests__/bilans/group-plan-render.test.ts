import fs from 'node:fs';
import path from 'node:path';

import { buildGroupPlanExampleArtifacts } from '@/scripts/bilans/generate-group-plan-example';

describe('A111 internal group plan rendering', () => {
  jest.setTimeout(90_000);
  it('matches the committed HTML/PDF example byte-for-byte', async () => {
    const artifacts = await buildGroupPlanExampleArtifacts();
    expect([...artifacts.keys()].sort()).toEqual(['entree-premiere-maths-v1-groupe.html', 'entree-premiere-maths-v1-groupe.pdf']);
    for (const [name, content] of artifacts) expect(content).toEqual(fs.readFileSync(path.join(process.cwd(), 'docs/specs/bilans/exemples', name)));
    const html = artifacts.get('entree-premiere-maths-v1-groupe.html')!.toString('utf8');
    expect(html).toContain('Document interne confidentiel');
    expect(html).toContain('Élève A (synthétique)');
    expect(html).toContain('Séance 5 sur 5');
    expect(html).toContain('minutes de contenu planifié');
    expect(html).toContain('se poursuit en séance suivante');
    expect(html).toContain('Suite de la séance précédente');
    const starts = [...html.matchAll(/<article class="node" data-node="([^"]+)" data-segment="START">([\s\S]*?)<\/article>/g)];
    expect(starts.length).toBeGreaterThan(0);
    for (const [, nodeId, startBlock] of starts) {
      expect(startBlock).toContain('min au total');
      const continuation = html.match(new RegExp(`<article class="node" data-node="${nodeId}" data-segment="CONTINUATION">([\\s\\S]*?)<\\/article>`));
      expect(continuation).not.toBeNull();
      expect(continuation?.[1]).toContain('Suite de la séance précédente');
      expect(continuation?.[1]).not.toContain('min au total');
    }
  });
});
