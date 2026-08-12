import fs from 'node:fs';
import path from 'node:path';

import { buildRenderedExampleArtifacts } from '@/scripts/bilans/generate-rendered-examples';
import { extractPdfText } from '@/lib/bilans/render/pdf';
import { assertVersionedPdfChromium } from './helpers/pdf-engine';

/**
 * Les HTML sont comparés octet par octet : le rendu HTML est déterministe.
 *
 * Les PDF sont comparés sur leur CONTENU (texte extrait, page à page), pas
 * sur leurs octets : les énoncés de banque contiennent des glyphes hors
 * couverture de DM Sans (√, ≥, ≤, ∪, ∩) que Chromium rend via une police de
 * repli du système hôte — le sous-ensemble de police embarqué, et donc la
 * numérotation interne des objets PDF, varient d'une machine à l'autre pour
 * un même build Chromium. Figer les octets reviendrait à figer la machine
 * de génération. Le texte extrait, lui, est indépendant de la police de
 * repli, et la famille de moteur reste verrouillée par
 * assertVersionedPdfChromium.
 */
describe('A95 versioned Canonical rendered examples', () => {
  jest.setTimeout(120_000);

  it('matches the six committed artifacts — HTML byte-for-byte, PDF by extracted content', async () => {
    assertVersionedPdfChromium();
    const artifacts = await buildRenderedExampleArtifacts();
    expect([...artifacts.keys()].sort()).toEqual([
      'entree-premiere-maths-v1-eleve.html',
      'entree-premiere-maths-v1-eleve.pdf',
      'entree-premiere-maths-v1-nexus.html',
      'entree-premiere-maths-v1-nexus.pdf',
      'entree-premiere-maths-v1-parents.html',
      'entree-premiere-maths-v1-parents.pdf',
    ]);

    for (const [name, content] of artifacts) {
      const committed = fs.readFileSync(path.join(process.cwd(), 'docs', 'specs', 'bilans', 'exemples', name));
      if (name.endsWith('.html')) {
        expect(content).toEqual(committed);
        continue;
      }
      expect(content.subarray(0, 4).toString()).toBe('%PDF');
      expect(committed.subarray(0, 4).toString()).toBe('%PDF');
      const [generatedText, committedText] = await Promise.all([
        extractPdfText(content),
        extractPdfText(committed),
      ]);
      expect(generatedText.length).toBeGreaterThan(0);
      // Comparaison page à page pour un diagnostic lisible en cas d'écart.
      expect(generatedText.split('\n')).toEqual(committedText.split('\n'));
    }
  });
});
