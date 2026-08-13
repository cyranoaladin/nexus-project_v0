/**
 * Le nuage de calibration reste lisible — document de travail des enseignants.
 *
 * Défaut réel du 13/08/2026 : libellés de domaines superposés dans
 * « Calibration : réussite × confiance déclarée ». Le placement est désormais
 * déterministe et anti-collision (lignes de rappel quand un libellé s'écarte).
 * On le verrouille sur le CAS DENSE : huit domaines dont plusieurs points
 * quasi confondus.
 */

import { placeCalibrationLabels, renderCalibrationSvg } from '@/lib/bilans/render/charts';

const BOUNDS = { minX: 46, maxX: 622, minY: 26, maxY: 266 };

const LABEL_CHAR_WIDTH = 5.2;
const LABEL_HEIGHT = 11;

function boxOf(placed: ReturnType<typeof placeCalibrationLabels>[number]) {
  const width = Math.max(18, placed.label.length * LABEL_CHAR_WIDTH);
  return placed.anchor === 'start'
    ? { left: placed.labelX, right: placed.labelX + width, top: placed.labelY - LABEL_HEIGHT + 2, bottom: placed.labelY + 2 }
    : { left: placed.labelX - width, right: placed.labelX, top: placed.labelY - LABEL_HEIGHT + 2, bottom: placed.labelY + 2 };
}

// Huit domaines, quatre quasi confondus autour de (300, 120) — le pire cas
// réaliste d'un bilan dense.
const DENSE = [
  { label: 'Calcul numérique', x: 300, y: 120 },
  { label: 'Fractions', x: 303, y: 122 },
  { label: 'Proportionnalité', x: 298, y: 118 },
  { label: 'Équations', x: 305, y: 119 },
  { label: 'Géométrie', x: 120, y: 60 },
  { label: 'Fonctions', x: 122, y: 62 },
  { label: 'Statistiques', x: 520, y: 200 },
  { label: 'Calcul littéral', x: 522, y: 202 },
];

describe('placeCalibrationLabels — anti-collision déterministe', () => {
  it('aucune paire de libellés ne se chevauche sur le cas dense', () => {
    const placed = placeCalibrationLabels(DENSE, BOUNDS);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = boxOf(placed[i]);
        const b = boxOf(placed[j]);
        const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(`${placed[i].label} × ${placed[j].label} : ${overlap ? 'CHEVAUCHENT' : 'ok'}`)
          .toBe(`${placed[i].label} × ${placed[j].label} : ok`);
      }
    }
  });

  it('un libellé déplacé au-delà du voisinage reçoit sa ligne de rappel', () => {
    // Six points au MÊME endroit : les quatre ancrages immédiats saturent,
    // les suivants s'étagent — et doivent être reliés à leur point.
    const pile = Array.from({ length: 6 }, (_, i) => ({
      label: `Domaine ${i + 1}`, x: 300 + i, y: 120,
    }));
    const placed = placeCalibrationLabels(pile, BOUNDS);
    expect(placed.some((p) => p.leader)).toBe(true);
    // Et toujours aucun chevauchement, même saturé.
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = boxOf(placed[i]);
        const b = boxOf(placed[j]);
        expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).toBe(false);
      }
    }
  });

  it('est déterministe : deux appels identiques, positions identiques', () => {
    expect(placeCalibrationLabels(DENSE, BOUNDS)).toEqual(placeCalibrationLabels(DENSE, BOUNDS));
  });

  it('le SVG rendu porte tous les libellés', () => {
    const svg = renderCalibrationSvg(DENSE.map(({ label, x, y }) => ({
      label,
      score: ((x - BOUNDS.minX) / (BOUNDS.maxX - BOUNDS.minX)) * 100,
      confidence: 1 + (1 - (y - BOUNDS.minY) / (BOUNDS.maxY - BOUNDS.minY)) * 3,
    })));
    for (const { label } of DENSE) expect(svg).toContain(label);
  });
});
