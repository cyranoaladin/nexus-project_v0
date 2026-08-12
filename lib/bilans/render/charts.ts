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
export function renderScoreBarsSvg(rows: readonly ScoreBarRow[]): string {
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

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Scores par domaine" xmlns="http://www.w3.org/2000/svg">${gridLines}${bars}<line x1="${midX}" y1="${topPadding - 2}" x2="${midX}" y2="${height - 8}" style="stroke:var(--color-lux-line);stroke-width:0.5"/></svg>`;
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

  const dots = points.map((point, index) => {
    const x = xFor(point.score);
    const y = yFor(point.confidence);
    const anchor = point.score > 72 ? 'end' : 'start';
    const dx = point.score > 72 ? -7 : 7;
    const dy = index % 2 === 0 ? -6 : 12;
    return [
      `<circle cx="${x}" cy="${y}" r="4" style="fill:var(--color-lux-ink)"/>`,
      `<text x="${x + dx}" y="${y + dy}" text-anchor="${anchor}" style="font-size:9px;fill:var(--color-lux-ink)">${escapeXml(point.label)}</text>`,
    ].join('');
  }).join('');

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
