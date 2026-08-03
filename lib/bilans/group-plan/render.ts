import { bilanPackSubjectLabel } from '../catalog/subjects';
import { BILAN_PRINT_BRAND, bilanPrintTokenCss } from '../render/brand';
import { renderHtmlToPdf } from '../render/pdf';
import { assertRenderIdentity, type RenderIdentity } from '../render/render-identity';
import { bilanPackLevelLabel } from '../render/stage-label';
import type { GroupNodeSessionSegment, GroupPlan } from './plan';

export const GROUP_PLAN_HTML_VERSION = 'nexus-group-plan-html.v1' as const;

function escapeHtml(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function nodeBlock(node: GroupNodeSessionSegment): string {
  const divided = node.dividedGroups === null ? '' : `<div class="divided"><strong>Différenciation</strong><p>Acquis : ${node.dividedGroups.acquired.map(escapeHtml).join(', ')}</p><p>En difficulté : ${node.dividedGroups.difficulty.map(escapeHtml).join(', ')}</p></div>`;
  const continuation = node.segmentPosition === 'START'
    ? '<p class="continuation">Ce nœud se poursuit en séance suivante.</p>'
    : node.segmentPosition === 'CONTINUATION'
      ? '<p class="continuation">Suite de la séance précédente.</p>'
      : '';
  const treatment = node.segmentPosition === 'CONTINUATION'
    ? ''
    : `<p><strong>${escapeHtml(node.profile)}</strong> · ${escapeHtml(node.treatment)} · ${escapeHtml(node.totalMinutes)} min au total</p>${divided}`;
  return `<article class="node" data-node="${escapeHtml(node.nodeCpsId)}" data-segment="${node.segmentPosition}"><header><span>${escapeHtml(node.segmentMinutes)} min dans cette séance</span><h3>${escapeHtml(node.label)}</h3></header>${continuation}${treatment}<table><thead><tr><th>Élève</th><th>Point de vigilance</th></tr></thead><tbody>${node.studentGuidance.map((student) => `<tr><td>${escapeHtml(student.displayName)}</td><td>${escapeHtml(student.guidance)}</td></tr>`).join('')}</tbody></table></article>`;
}

function nodeList(nodeIds: readonly string[]): string {
  return nodeIds.length === 0 ? '<p>—</p>' : `<ul>${nodeIds.map((nodeId) => `<li>${escapeHtml(nodeId)}</li>`).join('')}</ul>`;
}

function styleSheet(): string {
  return `@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.display}';src:url('${BILAN_PRINT_BRAND.fonts.displayAsset}') format('woff2')}@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.body}';src:url('${BILAN_PRINT_BRAND.fonts.bodyAsset}') format('woff2')}
  :root{${bilanPrintTokenCss()}}*{box-sizing:border-box}body{margin:0;background:var(--color-lux-ivory);color:var(--color-lux-ink);font-family:var(--font-dm-sans);font-size:9.5pt;line-height:1.45}.document{width:210mm;margin:0 auto;background:var(--color-lux-paper)}.page{min-height:297mm;padding:14mm 15mm 17mm;break-after:page}.page:last-child{break-after:auto}h1,h2,h3{font-family:var(--font-fraunces);font-weight:600}h1{font-size:21pt;margin:0}h2{font-size:15pt;border-bottom:1px solid var(--color-lux-gold);padding-bottom:2mm}h3{font-size:12pt;margin:0}.report-header{display:flex;gap:7mm;align-items:center;border-bottom:2px solid var(--color-lux-gold);padding-bottom:6mm}.brand-logo{width:48mm;height:auto}.eyebrow{color:var(--color-lux-gold-deep);font-weight:700;text-transform:uppercase;letter-spacing:.07em}.confidential{padding:4mm;background:var(--color-lux-ink);color:var(--color-lux-on-dark);border-left:4px solid var(--color-lux-gold)}.warning{padding:4mm;border:1px solid var(--color-lux-gold);background:var(--color-lux-gold-wash)}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.summary-grid section,.node{border:1px solid var(--color-lux-line);border-radius:3mm;padding:4mm;background:var(--color-lux-white)}.node{margin-top:4mm;break-inside:avoid}.node header{display:flex;align-items:center;gap:4mm}.node header span{color:var(--color-lux-gold-deep);font-weight:700;white-space:nowrap}.continuation{color:var(--color-lux-gold-deep);font-weight:700}.divided{border-left:3px solid var(--color-lux-gold);padding-left:3mm}table{width:100%;border-collapse:collapse;margin-top:3mm}th,td{text-align:left;vertical-align:top;padding:2mm;border-bottom:1px solid var(--color-lux-line)}th{color:var(--color-lux-slate)}.footer{display:flex;align-items:center;gap:3mm;margin-top:8mm;padding-top:3mm;border-top:1px solid var(--color-lux-line);color:var(--color-lux-slate)}.footer img{width:9mm;height:9mm}@page{size:A4;margin:0}@media print{body{background:var(--color-lux-white)}.document{margin:0}}`;
}

export function renderGroupPlanHtml(plan: GroupPlan, suppliedIdentity: RenderIdentity): string {
  const identity = assertRenderIdentity(suppliedIdentity);
  const warning = plan.schedulingStatus === 'READY' ? '' : `<section class="warning"><h2>Arbitrage enseignant requis</h2>${plan.schedulingWarnings.map((entry) => `<p>${escapeHtml(entry)}</p>`).join('')}<p>Les durées pédagogiques sont conservées sans redistribution.</p></section>`;
  const cover = `<section class="page"><header class="report-header"><img class="brand-logo" src="${BILAN_PRINT_BRAND.logos.header}" alt="Nexus Réussite"><div><p class="eyebrow">Plan de groupe · Interne Nexus</p><h1>${escapeHtml(identity.stageLabel)}</h1><p><strong>${escapeHtml(identity.displayName)}</strong> · ${escapeHtml(bilanPackLevelLabel(identity.level))} · ${escapeHtml(bilanPackSubjectLabel(identity.subject))} · ${escapeHtml(identity.date)}</p></div></header><p class="confidential">Document interne confidentiel. Il contient les noms et profils pédagogiques des élèves du groupe. Il ne doit être transmis ni aux élèves ni aux parents.</p>${warning}<h2>Synthèse du groupe</h2><div class="summary-grid"><section><h3>Acquis par tout le groupe</h3>${nodeList(plan.summary.acquiredByAll)}<p>Traitement : rappel actif.</p></section><section><h3>Difficulté généralisée</h3>${nodeList(plan.summary.generalizedDifficulty)}<p>Traitement : cœur du stage.</p></section><section><h3>Points de différenciation</h3>${nodeList(plan.summary.divided)}<p>Traitement : sous-groupes en séance.</p></section></div><h2>Bande de calibration indicative</h2><p>${escapeHtml(plan.calibrationRange.lowest)} → ${escapeHtml(plan.calibrationRange.highest)}. Cette indication aide à calibrer le groupe ; elle ne constitue jamais un classement.</p><footer class="footer"><img src="${BILAN_PRINT_BRAND.logos.compact}" alt=""><span>Nexus Réussite · Document pédagogique confidentiel</span></footer></section>`;
  const sessions = plan.sessions.map((session) => `<section class="page"><p class="eyebrow">Séance ${session.index} sur 5</p><h1>${escapeHtml(session.contentMinutes)} minutes de contenu planifié</h1><p>La présence reste fixée à deux heures ; l'écart est absorbé par l'accueil, les transitions, les questions et la clôture.</p>${session.nodes.map(nodeBlock).join('')}<footer class="footer"><img src="${BILAN_PRINT_BRAND.logos.compact}" alt=""><span>Nexus Réussite · Plan interne du groupe</span></footer></section>`).join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(identity.stageLabel)} · GROUPE</title><style>${styleSheet()}</style></head><body><main class="document" data-audience="GROUPE" data-template="${GROUP_PLAN_HTML_VERSION}">${cover}${sessions}</main></body></html>`;
}

export type GroupPlanPdfResult = Readonly<{ status: 'AVAILABLE'; html: string; pdf: Buffer }> | Readonly<{ status: 'UNAVAILABLE'; html: string; errorCode: 'GROUP_PLAN_PDF_RENDER_FAILED' }>;

export async function renderGroupPlanPdf(plan: GroupPlan, identity: RenderIdentity, dependencies: Readonly<{ renderHtmlToPdf?: (html: string) => Promise<Buffer> }> = {}): Promise<GroupPlanPdfResult> {
  const html = renderGroupPlanHtml(plan, identity);
  try {
    const pdf = await (dependencies.renderHtmlToPdf ?? renderHtmlToPdf)(html);
    if (!pdf.subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('INVALID_PDF_MAGIC');
    return Object.freeze({ status: 'AVAILABLE', html, pdf });
  } catch {
    return Object.freeze({ status: 'UNAVAILABLE', html, errorCode: 'GROUP_PLAN_PDF_RENDER_FAILED' });
  }
}
