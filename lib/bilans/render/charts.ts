import { frenchTypography } from './typography';

/**
 * Graphiques SVG des bilans — générés sans aucune dépendance, en s'appuyant
 * sur les jetons de la charte print (`--color-lux-*`) hérités du document
 * hôte. Réservés au document interne Nexus : les restitutions élève et
 * parents restent qualitatives (aucun score brut n'y est licite).
 *
 * Tout est déterministe : mêmes données, même SVG, au caractère près.
 */

export const BILAN_CHARTS_VERSION = 'bilan-charts.v1' as const;

function escapeXml(value: string): string {
  return frenchTypography(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1).replace('.', ',');
}

export type ScoreBarRow = Readonly<{
  label: string;
  score: number;
  /** Domaine à traiter en priorité (profil sévère) — barre soulignée à l'or. */
  priority?: boolean;
}>;

/**
 * Barres horizontales des scores par domaine (0 à 100). Libellé à gauche,
 * barre au centre, valeur à droite.
 */
export function renderScoreBarsSvg(rows: readonly ScoreBarRow[], ariaLabel = 'Scores par domaine'): string {
  const labelWidth = 218;
  const valueWidth = 44;
  const trackWidth = 380;
  const rowHeight = 27;
  const barHeight = 11;
  const topPadding = 8;
  const width = labelWidth + trackWidth + valueWidth + 18;
  const height = topPadding + rows.length * rowHeight + 6;

  const bars = rows.map((row, index) => {
    const y = topPadding + index * rowHeight;
    const barY = y + (rowHeight - barHeight) / 2 - 2;
    const clamped = Math.max(0, Math.min(100, row.score));
    const barWidth = Math.round((clamped / 100) * trackWidth * 100) / 100;
    const fill = row.priority === true ? 'var(--color-lux-gold-deep)' : 'var(--color-lux-ink)';
    return [
      `<text x="${labelWidth - 8}" y="${y + rowHeight / 2 + 2}" text-anchor="end" style="font-size:10px;fill:var(--color-lux-ink)">${escapeXml(row.label)}</text>`,
      `<rect x="${labelWidth}" y="${barY}" width="${trackWidth}" height="${barHeight}" rx="3" style="fill:var(--color-lux-gold-wash)"/>`,
      `<rect x="${labelWidth}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" style="fill:${fill}"/>`,
      `<text x="${labelWidth + trackWidth + 10}" y="${y + rowHeight / 2 + 2}" style="font-size:10px;fill:var(--color-lux-slate)">${formatScore(clamped)}</text>`,
    ].join('');
  }).join('');

  const midX = labelWidth + trackWidth / 2;
  const gridLines = [0, 25, 50, 75, 100].map((tick) => {
    const x = labelWidth + (tick / 100) * trackWidth;
    return `<line x1="${x}" y1="${topPadding - 2}" x2="${x}" y2="${height - 8}" style="stroke:var(--color-lux-line);stroke-width:0.5"/>`;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${escapeXml(ariaLabel)}" xmlns="http://www.w3.org/2000/svg">${gridLines}${bars}<line x1="${midX}" y1="${topPadding - 2}" x2="${midX}" y2="${height - 8}" style="stroke:var(--color-lux-line);stroke-width:0.5"/></svg>`;
}


export type PlacedCalibrationLabel = Readonly<{
  label: string;
  x: number;
  y: number;
  labelX: number;
  labelY: number;
  anchor: 'start' | 'end';
  /** Vrai quand le libellé a dû s'éloigner du point : une ligne de rappel le relie. */
  leader: boolean;
  lineX: number;
  lineY: number;
}>;

const LABEL_CHAR_WIDTH = 5.2;
const LABEL_HEIGHT = 11;

type LabelBox = Readonly<{ left: number; right: number; top: number; bottom: number }>;

function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Placement DÉTERMINISTE des libellés du nuage de calibration, sans
 * chevauchement : c'est le document de travail des enseignants, il doit se
 * lire même quand huit domaines se serrent dans la même zone (le rendu réel
 * du 13/08/2026 superposait les noms). Pour chaque point — ordre d'entrée
 * conservé, celui du pack — on essaie des positions candidates de plus en
 * plus éloignées (droite, gauche, dessus, dessous, puis étages verticaux) et
 * on retient la première qui ne recouvre ni un libellé déjà posé, ni un point,
 * ni le bord du cadre. Un libellé déplacé au-delà du voisinage immédiat reçoit
 * une ligne de rappel.
 */
export function placeCalibrationLabels(
  points: readonly Readonly<{ label: string; x: number; y: number }>[],
  bounds: Readonly<{ minX: number; maxX: number; minY: number; maxY: number }>,
): readonly PlacedCalibrationLabel[] {
  const placedBoxes: LabelBox[] = points.map((point) => ({
    left: point.x - 5, right: point.x + 5, top: point.y - 5, bottom: point.y + 5,
  }));
  const result: PlacedCalibrationLabel[] = [];

  for (const point of points) {
    const labelWidth = Math.max(18, point.label.length * LABEL_CHAR_WIDTH);
    const candidates: Array<Readonly<{ dx: number; dy: number; anchor: 'start' | 'end' }>> = [];
    for (const tier of [0, 1, 2, 3, 4]) {
      const lift = tier * (LABEL_HEIGHT + 2);
      candidates.push(
        { dx: 7, dy: -4 - lift, anchor: 'start' },
        { dx: -7, dy: -4 - lift, anchor: 'end' },
        { dx: 7, dy: 13 + lift, anchor: 'start' },
        { dx: -7, dy: 13 + lift, anchor: 'end' },
      );
    }

    let chosen: Readonly<{ dx: number; dy: number; anchor: 'start' | 'end' }> | null = null;
    let chosenBox: LabelBox | null = null;
    for (const candidate of candidates) {
      const labelX = point.x + candidate.dx;
      const labelY = point.y + candidate.dy;
      const box: LabelBox = candidate.anchor === 'start'
        ? { left: labelX, right: labelX + labelWidth, top: labelY - LABEL_HEIGHT + 2, bottom: labelY + 2 }
        : { left: labelX - labelWidth, right: labelX, top: labelY - LABEL_HEIGHT + 2, bottom: labelY + 2 };
      const inBounds = box.left >= bounds.minX - 2 && box.right <= bounds.maxX + 2
        && box.top >= bounds.minY - 14 && box.bottom <= bounds.maxY + 14;
      if (inBounds && !placedBoxes.some((existing) => boxesOverlap(existing, box))) {
        chosen = candidate;
        chosenBox = box;
        break;
      }
    }
    // Dernier recours (cadre saturé) : dernière candidate, hors collision de
    // points au moins — jamais de superposition silencieuse de deux libellés
    // déjà posés puisque placedBoxes n'est alors pas enrichi d'une boîte fictive.
    const fallback = candidates[candidates.length - 1];
    const use = chosen ?? fallback;
    const labelX = point.x + use.dx;
    const labelY = point.y + use.dy;
    if (chosenBox !== null) placedBoxes.push(chosenBox);
    const displaced = Math.abs(use.dy) > LABEL_HEIGHT + 4;
    result.push(Object.freeze({
      label: point.label,
      x: point.x,
      y: point.y,
      labelX,
      labelY,
      anchor: use.anchor,
      leader: displaced,
      lineX: labelX + (use.anchor === 'start' ? 2 : -2),
      lineY: labelY - 3,
    }));
  }
  return Object.freeze(result);
}

export type CalibrationPoint = Readonly<{
  label: string;
  score: number;
  /** Confiance moyenne déclarée, de 1 à 4. */
  confidence: number;
}>;

/**
 * Carte de calibration : réussite (abscisse) × confiance déclarée
 * (ordonnée). La zone en haut à gauche — confiance élevée, réussite faible —
 * est la zone d'erreur confiante, matérialisée par un fond doré.
 */
export function renderCalibrationSvg(points: readonly CalibrationPoint[]): string {
  const width = 640;
  const height = 300;
  const margin = { top: 26, right: 18, bottom: 34, left: 46 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xFor = (score: number) => margin.left + (Math.max(0, Math.min(100, score)) / 100) * plotWidth;
  const yFor = (confidence: number) => {
    const clamped = Math.max(1, Math.min(4, confidence));
    return margin.top + (1 - (clamped - 1) / 3) * plotHeight;
  };
  const midX = xFor(50);
  const midY = yFor(2.5);

  const labels = placeCalibrationLabels(
    points.map((point) => ({ label: point.label, x: xFor(point.score), y: yFor(point.confidence) })),
    { minX: margin.left, maxX: margin.left + plotWidth, minY: margin.top, maxY: margin.top + plotHeight },
  );
  const dots = labels.map((placed) => [
    `<circle cx="${placed.x}" cy="${placed.y}" r="4" style="fill:var(--color-lux-ink)"/>`,
    placed.leader
      ? `<line x1="${placed.x}" y1="${placed.y}" x2="${placed.lineX}" y2="${placed.lineY}" style="stroke:var(--color-lux-slate);stroke-width:0.5"/>`
      : '',
    `<text x="${placed.labelX}" y="${placed.labelY}" text-anchor="${placed.anchor}" style="font-size:9px;fill:var(--color-lux-ink)">${escapeXml(placed.label)}</text>`,
  ].join('')).join('');

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Calibration : réussite et confiance par domaine" xmlns="http://www.w3.org/2000/svg">
<rect x="${margin.left}" y="${margin.top}" width="${midX - margin.left}" height="${midY - margin.top}" style="fill:var(--color-lux-gold-wash)"/>
<rect x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" style="fill:none;stroke:var(--color-lux-line)"/>
<line x1="${midX}" y1="${margin.top}" x2="${midX}" y2="${margin.top + plotHeight}" style="stroke:var(--color-lux-line)"/>
<line x1="${margin.left}" y1="${midY}" x2="${margin.left + plotWidth}" y2="${midY}" style="stroke:var(--color-lux-line)"/>
<text x="${margin.left + 6}" y="${margin.top + 13}" style="font-size:9px;fill:var(--color-lux-gold-deep);font-weight:700">${escapeXml('Erreurs confiantes — zone prioritaire')}</text>
<text x="${margin.left + plotWidth - 6}" y="${margin.top + 13}" text-anchor="end" style="font-size:9px;fill:var(--color-lux-evergreen);font-weight:700">${escapeXml('Maîtrise assurée')}</text>
<text x="${margin.left + 6}" y="${margin.top + plotHeight - 7}" style="font-size:9px;fill:var(--color-lux-slate)">${escapeXml('Lacunes conscientes')}</text>
<text x="${margin.left + plotWidth - 6}" y="${margin.top + plotHeight - 7}" text-anchor="end" style="font-size:9px;fill:var(--color-lux-slate)">${escapeXml('Maîtrise fragile')}</text>
<text x="${margin.left + plotWidth / 2}" y="${height - 8}" text-anchor="middle" style="font-size:9px;fill:var(--color-lux-slate)">${escapeXml('Réussite (0 à 100)')}</text>
<text x="14" y="${margin.top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 14 ${margin.top + plotHeight / 2})" style="font-size:9px;fill:var(--color-lux-slate)">${escapeXml('Confiance déclarée (1 à 4)')}</text>
${dots}</svg>`;
}
