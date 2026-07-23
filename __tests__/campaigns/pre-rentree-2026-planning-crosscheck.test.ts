/**
 * D3 — Cohérence croisée automatisée des créneaux : JSON scellé ↔ PDF Planning publié.
 * La page publique rend le planning à partir du même JSON scellé (composant data-driven),
 * donc vérifier JSON ↔ PDF verrouille la chaîne de bout en bout. Divergence = échec.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import manifest from '@/data/campaigns/pre-rentree-2026.json';

const PDF = join(
  process.cwd(),
  'assets/campaigns/pre-rentree-2026/documents-final/NexusReussite_PreRentree2026_Planning_InfosPratiques.pdf',
);

type Slot = { level: string; subject: string; block: string; room: string };
type Week = { week: number; slots: Slot[] };

const blockTimes = new Map(
  (manifest.blocks as Array<{ id: string; startTime: string; endTime: string }>).map((b) => [
    b.id,
    `${b.startTime}–${b.endTime}`, // en dash, comme dans le PDF
  ]),
);

function pdfText(): string {
  return execFileSync('pdftotext', ['-layout', PDF, '-'], { encoding: 'utf8' });
}

const maybe = existsSync(PDF) ? describe : describe.skip;

maybe('Pré-rentrée 2026 — cohérence créneaux JSON ↔ PDF Planning (D3)', () => {
  const text = existsSync(PDF) ? pdfText() : '';

  it('chaque créneau du JSON scellé apparaît dans le PDF Planning', () => {
    const missing: string[] = [];
    for (const week of manifest.schedule as unknown as Week[]) {
      for (const slot of week.slots) {
        const needle = blockTimes.get(slot.block)!;
        if (!text.includes(needle)) {
          missing.push(`S${week.week} ${slot.level}/${slot.subject} ${slot.block} ${needle}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('le PDF ne contient aucun horaire du soir (bloc E supprimé, D4-final)', () => {
    expect(text).not.toContain('18:00');
    expect(text).not.toContain('20:00');
  });

  it('la SVT figure au planning en Première et Terminale', () => {
    expect(text).toMatch(/SVT/);
    // Placement scellé : SVT Terminale bloc B/salle-1, SVT Première bloc C/salle-2.
    const svt = (manifest.schedule as unknown as Week[]).flatMap((w) => w.slots).filter((s) => s.subject === 'SVT');
    expect(new Set(svt.map((s) => s.level))).toEqual(new Set(['PREMIERE', 'TERMINALE']));
  });
});
