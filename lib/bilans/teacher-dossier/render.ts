/**
 * Rendu HTML/PDF du dossier enseignant — un document unique par matière ×
 * niveau. Réutilise le moteur de rendu des bilans (`render/pdf.ts`,
 * `render/brand.ts`, `render/typography.ts`) : aucun second moteur.
 *
 * Document STRICTEMENT interne : porte les vrais noms des élèves, jamais un
 * pseudonyme, et n'est jamais éligible à un lien signé (le staff seul y
 * accède, via une route dédiée — voir `staff/teacher-dossier-service.ts`).
 *
 * Périmètre de cette version : sections A→G + fiche récapitulative 1 page.
 * La prise de notes, la grille d'appel et les indicateurs de fin de stage
 * (H2-H4) sont volontairement hors périmètre — voir le plan.
 *
 * Limite connue et assumée : Chromium ne supporte pas la génération de
 * numéros de page vivants pour les boîtes de marge CSS (`@bottom-center`
 * paged-media), et `renderHtmlToPdf` n'expose pas les en-têtes/pieds de page
 * de Playwright. Le sommaire liste donc les sections sans numéro de page —
 * un fast-follow documenté plutôt qu'une fonctionnalité simulée.
 */

import { bilanPackSubjectLabel } from '../catalog/subjects';
import type { FactSheet } from '../facts/fact-sheet';
import { SEVERITY_RANK } from '../facts/constants';
import type { NodeProfile } from '../facts/types';
import type { TeacherBriefContent } from '../llm/teacher-brief-schema';
import {
  APPROVED_BRIEF_SAFETY_MARKER,
  assertValidTeacherDossierStudentBrief,
} from '../staff/teacher-dossier-safety';
import { BILAN_PRINT_BRAND, bilanPrintTokenCss } from '../render/brand';
import { renderHtmlToPdf } from '../render/pdf';
import {
  chosenOption,
  correctOption,
  evidenceItemStatus,
  type EvidenceItem,
  type QuestionEvidence,
} from '../render/question-evidence';
import { assertRenderIdentity, type RenderIdentity } from '../render/render-identity';
import { bilanPackLevelLabel } from '../render/stage-label';
import { frenchTypography } from '../render/typography';
import type { DossierGroupAnalysis, DossierSessionPlan } from './aggregate';

export const TEACHER_DOSSIER_HTML_VERSION = 'nexus-teacher-dossier-html.v1' as const;

export type DossierHeaderInput = Readonly<{
  teacherName?: string;
  room?: string;
  timeSlot?: string;
  stageDates?: string;
}>;

export type DossierStudentDetail = Readonly<{
  displayName: string;
  factSheet: FactSheet;
  evidence: QuestionEvidence;
  /** `null` quand le brief n'a pas encore été généré ou n'est pas approuvé. */
  brief: TeacherBriefContent | null;
  /** Marqueur de sécurité explicite posé uniquement par teacher-dossier-service.ts. */
  briefSafetyMarker?: typeof APPROVED_BRIEF_SAFETY_MARKER;
}>;

export type TeacherDossierDocument = Readonly<{
  identity: RenderIdentity;
  header: DossierHeaderInput;
  students: readonly DossierStudentDetail[];
  /** Élèves du niveau non inclus (pack différent, etc.) — jamais omis en silence. */
  excludedStudents: readonly Readonly<{ displayName: string; reason: string }>[];
  analysis: DossierGroupAnalysis;
  /** `null` quand le pack n'a pas de catalogue CPS associé — signalé, jamais tu. */
  sessionPlan: DossierSessionPlan | null;
  evidenceCatalog: QuestionEvidence;
  generatedAt: string;
}>;

function escapeHtml(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function text(value: unknown): string {
  return escapeHtml(frenchTypography(String(value)));
}

function fillBlank(value: string | undefined, width = '38mm'): string {
  return value !== undefined && value.trim().length > 0
    ? text(value)
    : `<span class="fill-blank" style="width:${width}"></span>`;
}

const PROFILE_LABELS: Readonly<Record<NodeProfile, string>> = Object.freeze({
  MAITRISE: 'Maîtrise', MAITRISE_FRAGILE: 'Maîtrise fragile', LACUNE_CONSCIENTE: 'Lacune consciente',
  ERREUR_CONFIANTE: 'Erreur confiante', NON_TRAITE: 'Non traité',
});

function profileBadge(profile: NodeProfile | 'DIVISE'): string {
  return `<span class="profile profile--${profile.toLowerCase().replace(/_/g, '-')}">${profile === 'DIVISE' ? 'Groupe divisé' : PROFILE_LABELS[profile]}</span>`;
}

function styleSheet(): string {
  return `@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.display}';src:url('${BILAN_PRINT_BRAND.fonts.displayAsset}') format('woff2')}@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.body}';src:url('${BILAN_PRINT_BRAND.fonts.bodyAsset}') format('woff2')}
  :root{${bilanPrintTokenCss()}}*{box-sizing:border-box}body{margin:0;background:var(--color-lux-ivory);color:var(--color-lux-ink);font-family:var(--font-dm-sans);font-size:9.5pt;line-height:1.45}.document{width:210mm;margin:0 auto;background:var(--color-lux-paper)}.page{min-height:297mm;padding:14mm 15mm 17mm;break-after:page}.page:last-child{break-after:auto}h1,h2,h3{font-family:var(--font-fraunces);font-weight:600}h1{font-size:20pt;margin:0}h2{font-size:14pt;border-bottom:1px solid var(--color-lux-gold);padding-bottom:2mm;margin-top:6mm}h3{font-size:11pt;margin:0 0 2mm}.report-header{display:flex;gap:7mm;align-items:center;border-bottom:2px solid var(--color-lux-gold);padding-bottom:6mm}.brand-logo{width:42mm;height:auto}.eyebrow{color:var(--color-lux-gold-deep);font-weight:700;text-transform:uppercase;letter-spacing:.07em}.confidential{padding:4mm;background:var(--color-lux-ink);color:var(--color-lux-on-dark);border-left:4px solid var(--color-lux-gold);margin-top:4mm}.fill-blank{display:inline-block;border-bottom:1px solid var(--color-lux-slate);min-height:3.5mm}.header-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:3mm 8mm;margin-top:4mm}.header-grid dt{color:var(--color-lux-slate);font-size:8pt;text-transform:uppercase;letter-spacing:.04em}.header-grid dd{margin:0 0 2mm;font-weight:600}.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:3mm}.summary-grid section,.node,.student-block,.item-block{border:1px solid var(--color-lux-line);border-radius:3mm;padding:4mm;background:var(--color-lux-white)}.node,.student-block,.item-block{margin-top:4mm;break-inside:avoid}table{width:100%;border-collapse:collapse;margin-top:3mm}th,td{text-align:left;vertical-align:top;padding:2mm;border-bottom:1px solid var(--color-lux-line)}th{color:var(--color-lux-slate);font-size:8pt;text-transform:uppercase}.profile{display:inline-block;padding:.5mm 2mm;border-radius:2mm;font-size:8pt;font-weight:700;white-space:nowrap}.profile--erreur-confiante{background:var(--color-lux-gold-wash);color:var(--color-lux-gold-deep)}.profile--lacune-consciente{background:var(--color-lux-line);color:var(--color-lux-ink)}.profile--divise{background:var(--color-lux-gold-wash);color:var(--color-lux-gold-deep)}.profile--non-traite{background:var(--color-lux-line);color:var(--color-lux-slate)}.profile--maitrise-fragile{background:var(--color-lux-ivory);color:var(--color-lux-slate)}.profile--maitrise{background:var(--color-lux-ivory);color:var(--color-lux-slate);opacity:.7}.collective{border-left:3px solid var(--color-lux-gold-deep);padding-left:3mm}.toc ol{padding-left:5mm}.toc li{margin-bottom:1.5mm}.footer{display:flex;align-items:center;gap:3mm;margin-top:8mm;padding-top:3mm;border-top:1px solid var(--color-lux-line);color:var(--color-lux-slate)}.footer img{width:9mm;height:9mm}@page{size:A4;margin:0}@media print{body{background:var(--color-lux-white)}.document{margin:0}}`;
}

function footer(): string {
  return `<footer class="footer"><img src="${BILAN_PRINT_BRAND.logos.compact}" alt=""><span>Nexus Réussite · Document interne confidentiel</span></footer>`;
}

function headerGrid(identity: RenderIdentity, header: DossierHeaderInput, effectif: number): string {
  return `<dl class="header-grid">
    <div><dt>Matière</dt><dd>${text(bilanPackSubjectLabel(identity.subject))}</dd></div>
    <div><dt>Niveau</dt><dd>${text(bilanPackLevelLabel(identity.level))}</dd></div>
    <div><dt>Groupe / créneau</dt><dd>${fillBlank(header.timeSlot)}</dd></div>
    <div><dt>Salle</dt><dd>${fillBlank(header.room)}</dd></div>
    <div><dt>Dates du stage</dt><dd>${fillBlank(header.stageDates)}</dd></div>
    <div><dt>Effectif</dt><dd>${effectif}</dd></div>
    <div><dt>Enseignant</dt><dd>${fillBlank(header.teacherName, '55mm')}</dd></div>
    <div><dt>Dossier généré le</dt><dd>${text(identity.date)}</dd></div>
  </dl>`;
}

function summaryPage(doc: TeacherDossierDocument): string {
  const { analysis } = doc;
  const distribution = Object.entries(analysis.profileDistribution) as [NodeProfile, number][];
  const topFragile = analysis.domains.filter((domain) => domain.profile !== 'MAITRISE' && domain.profile !== 'MAITRISE_FRAGILE').slice(0, 3);
  return `<section class="page"><header class="report-header"><img class="brand-logo" src="${BILAN_PRINT_BRAND.logos.header}" alt="Nexus Réussite"><div><p class="eyebrow">Dossier enseignant · Interne Nexus</p><h1>${text(doc.identity.stageLabel)}</h1></div></header>
  <p class="confidential">Document strictly interne et confidentiel. Il contient les noms réels et les profils pédagogiques des élèves. Il ne doit jamais être transmis aux familles ni aux élèves.</p>
  <p class="collective"><strong>Version sécurisée — tout enrichissement LLM non validé est exclu.</strong></p>
  <h2>Fiche récapitulative</h2>
  ${headerGrid(doc.identity, doc.header, doc.students.length)}
  <div class="summary-grid">
    <section><h3>Répartition des profils</h3><table><tbody>${distribution.map(([profile, count]) => `<tr><td>${profileBadge(profile)}</td><td>${count}</td></tr>`).join('')}</tbody></table></section>
    <section><h3>Domaines les plus fragiles</h3>${topFragile.length === 0 ? '<p>Aucun domaine à traiter en priorité.</p>' : `<ol>${topFragile.map((domain) => `<li>${text(domain.domainId)} — ${profileBadge(domain.profile)}</li>`).join('')}</ol>`}</section>
    <section><h3>Calibration &amp; hétérogénéité</h3><p>Calibration moyenne : ${analysis.calibration.mean === null ? 'non disponible' : `${Math.round(analysis.calibration.mean)} / 100 (n=${analysis.calibration.sampleSize})`}.</p><p>Groupe ${analysis.heterogeneity.classification === 'HOMOGENE' ? 'homogène' : 'à différencier'} (écart-type ${Math.round(analysis.heterogeneity.scoreStddev)}, seuil ${analysis.heterogeneity.thresholdStddev}).</p></section>
  </div>
  ${doc.excludedStudents.length === 0 ? '' : `<p class="collective"><strong>${doc.excludedStudents.length} élève(s) non inclus dans ce dossier :</strong> ${doc.excludedStudents.map((student) => `${text(student.displayName)} (${text(student.reason)})`).join(', ')}.</p>`}
  ${footer()}</section>`;
}

function tocPage(): string {
  const sections = [
    'A · En-tête opérationnel', 'B · Vue d’ensemble du groupe', 'C · Énoncés du test',
    'D · Détail par élève', 'E · Brief enseignant', 'F · Lecture croisée du groupe', 'G · Conduite du stage',
  ];
  return `<section class="page toc"><h1>Sommaire</h1><p>La pagination Chromium ne restitue pas de numéro de page vivant pour ce document ; les sections se suivent dans cet ordre.</p><ol>${sections.map((entry) => `<li>${text(entry)}</li>`).join('')}</ol></section>`;
}

function sectionB(doc: TeacherDossierDocument): string {
  const { analysis, students } = doc;
  return `<section class="page"><p class="eyebrow">Section B</p><h1>Vue d'ensemble du groupe</h1>
  <h2>Liste nominative (${students.length})</h2><p>${students.map((student) => text(student.displayName)).join(', ')}</p>
  <h2>Domaines les plus fragiles collectivement</h2><table><thead><tr><th>Domaine</th><th>Profil de groupe</th><th>Répartition</th></tr></thead><tbody>${analysis.domains.map((domain) => `<tr><td>${text(domain.domainId)}</td><td>${profileBadge(domain.profile)}</td><td>${(Object.entries(domain.profileCounts) as [NodeProfile, number][]).filter(([, count]) => count > 0).map(([profile, count]) => `${count} ${PROFILE_LABELS[profile].toLowerCase()}`).join(' · ')}</td></tr>`).join('')}</tbody></table>
  <h2>Calibration et hétérogénéité</h2><p>Calibration moyenne du groupe : ${analysis.calibration.mean === null ? 'non disponible (aucune calibration exploitable)' : `${Math.round(analysis.calibration.mean)} / 100, écart-type ${Math.round(analysis.calibration.stddev ?? 0)} (n=${analysis.calibration.sampleSize}).`}</p>
  <p>Score global — moyenne ${Math.round(analysis.heterogeneity.scoreMean)}, écart-type ${Math.round(analysis.heterogeneity.scoreStddev)} : groupe classé <strong>${analysis.heterogeneity.classification === 'HOMOGENE' ? 'homogène' : 'à différencier'}</strong> (seuil ${analysis.heterogeneity.thresholdStddev}). ${analysis.heterogeneity.classification === 'A_DIFFERENCIER' ? 'La dispersion des scores justifie des sous-groupes dès la première séance.' : 'Le groupe peut être mené collectivement sans sous-groupes systématiques.'}</p>
  ${footer()}</section>`;
}

function sectionC(evidenceCatalog: QuestionEvidence): string {
  const items = evidenceCatalog.items.map((item, index) => `<article class="item-block"><h3>Question ${index + 1} — ${text(item.category)}</h3><p>${text(item.questionText)}</p><table><thead><tr><th>Option</th><th>Contenu</th><th>Statut</th></tr></thead><tbody>${item.options.map((option) => `<tr><td>${text(option.id)}</td><td>${text(option.text)}</td><td>${option.isCorrect ? 'Bonne réponse' : text(option.distractorRationale ?? '—')}</td></tr>`).join('')}</tbody></table><p><strong>Correction :</strong> ${text(item.shortCorrection)}</p></article>`).join('');
  return `<section class="page"><p class="eyebrow">Section C</p><h1>Énoncés du test</h1><p>Les questions passées par les élèves du groupe, avec la correction courte et l'explication de chaque distracteur.</p>${items}${footer()}</section>`;
}

function studentPriorities(factSheet: FactSheet): readonly string[] {
  return [...factSheet.domains].sort((left, right) => SEVERITY_RANK[right.profile] - SEVERITY_RANK[left.profile])
    .filter((domain) => domain.profile !== 'MAITRISE').slice(0, 3).map((domain) => domain.id);
}

function answerDetailRow(item: EvidenceItem): string {
  const status = evidenceItemStatus(item);
  const chosen = chosenOption(item);
  const correct = correctOption(item);
  const origin = status === 'A_REVOIR' ? (chosen?.distractorRationale ?? '—') : status === 'NON_TRAITE' ? 'Item non traité.' : '—';
  return `<tr><td>${text(item.category)}</td><td>${status === 'NON_TRAITE' ? '—' : text(chosen?.text ?? '—')}</td><td>${text(correct?.text ?? '—')}</td><td>${text(origin)}</td></tr>`;
}

function sectionD(students: readonly DossierStudentDetail[]): string {
  const blocks = students.map((student) => {
    const priorities = studentPriorities(student.factSheet);
    const treated = student.evidence.items.filter((item) => item.chosenOptionId !== null).length;
    return `<article class="student-block"><h3>${text(student.displayName)}</h3>
    <p><strong>Priorités :</strong> ${priorities.length === 0 ? 'aucune — profil globalement maîtrisé.' : priorities.map(text).join(', ')}.</p>
    <p><strong>Calibration :</strong> ${student.factSheet.calibrationIndex === null ? 'non disponible' : `${student.factSheet.calibrationIndex} / 100`} · <strong>Couverture :</strong> ${treated} / ${student.evidence.items.length} items traités.</p>
    <table><thead><tr><th>Domaine</th><th>Réponse donnée</th><th>Réponse attendue</th><th>Origine de l'erreur</th></tr></thead><tbody>${student.evidence.items.map(answerDetailRow).join('')}</tbody></table></article>`;
  }).join('');
  return `<section class="page"><p class="eyebrow">Section D</p><h1>Détail par élève</h1>${blocks}${footer()}</section>`;
}

function briefForDomain(students: readonly DossierStudentDetail[], domainId: string) {
  for (const student of students) {
    const found = student.brief?.domaines.find((entry) => entry.domainId === domainId);
    if (found !== undefined) return found;
  }
  return null;
}

function sectionE(doc: TeacherDossierDocument): string {
  const fragile = doc.analysis.domains.filter((domain) => domain.profile !== 'MAITRISE' && domain.profile !== 'MAITRISE_FRAGILE');
  const blocks = fragile.map((domain) => {
    const brief = briefForDomain(doc.students, domain.domainId);
    if (brief === null) {
      return `<article class="item-block"><h3>${text(domain.domainId)}</h3><p><em>Socle pédagogique déterministe utilisé — aucun brief enrichi validé.</em></p></article>`;
    }
    return `<article class="item-block"><h3>${text(domain.domainId)}</h3>
    <p><strong>Erreurs typiques attendues :</strong></p><ul>${brief.erreursTypiques.map((erreur) => `<li>${text(erreur.constat)} — <em>${text(erreur.origine)}</em></li>`).join('')}</ul>
    <p><strong>Prérequis à vérifier :</strong> ${brief.prerequisAVerifier.map(text).join(' · ')}</p>
    <p><strong>Activité :</strong> ${text(brief.activite.titre)} — ${text(brief.activite.objectif)}</p>
    <p><strong>Indicateur de progrès :</strong> ${text(brief.indicateurProgres)}</p></article>`;
  }).join('');
  return `<section class="page"><p class="eyebrow">Section E</p><h1>Brief enseignant</h1>${blocks.length === 0 ? '<p>Aucun domaine prioritaire identifié pour ce groupe.</p>' : blocks}${footer()}</section>`;
}

function sectionF(doc: TeacherDossierDocument): string {
  const { analysis } = doc;
  const confident = analysis.domains.filter((domain) => domain.profile === 'ERREUR_CONFIANTE');
  const collectiveItems = analysis.items.filter((item) => item.collectiveError);
  return `<section class="page"><p class="eyebrow">Section F</p><h1>Lecture croisée du groupe</h1>
  <h2>Domaines à traiter en premier, collectivement</h2>${confident.length === 0 ? '<p>Aucune erreur confiante généralisée.</p>' : `<ul>${confident.map((domain) => `<li>${text(domain.domainId)}</li>`).join('')}</ul>`}
  <h2>Erreurs collectives item par item</h2>${collectiveItems.length === 0 ? '<p>Aucun distracteur choisi par la moitié du groupe ou plus.</p>' : collectiveItems.map((item) => `<div class="collective"><strong>Erreur collective — ${text(item.questionText)}</strong><p>${item.distractorCounts[item.majorityDistractorOptionId as string]} / ${item.totalMembers} élèves ont choisi la même réponse erronée (${text(item.majorityDistractorOptionId ?? '')}) — à reprendre au tableau, pas individuellement.</p></div>`).join('')}
  <h2>Sous-groupes (profil partagé sur un domaine fragile)</h2>${analysis.clusters.length === 0 ? '<p>Aucun sous-groupe net identifié.</p>' : `<ul>${analysis.clusters.slice(0, 6).map((cluster) => `<li>${text(cluster.domainId)} — ${profileBadge(cluster.profile)} : ${cluster.students.map(text).join(', ')}</li>`).join('')}</ul>`}
  <h2>Acquis par tout le groupe</h2>${analysis.acquiredByAll.length === 0 ? '<p>Aucun domaine acquis par tous — rien à ne pas réexpliquer.</p>' : `<p>${analysis.acquiredByAll.map(text).join(', ')} — ne pas réexpliquer, au risque de perdre le groupe.</p>`}
  <h2>Élèves atypiques</h2>${analysis.atypicalStudents.length === 0 ? '<p>Aucun élève atypique identifié.</p>' : `<ul>${analysis.atypicalStudents.map((student) => `<li>${text(student.displayName)} — ${student.reason === 'TRES_EN_AVANCE' ? 'très en avance' : student.reason === 'TRES_EN_DIFFICULTE' ? 'très en difficulté' : 'beaucoup de non-traité'}</li>`).join('')}</ul>`}
  ${footer()}</section>`;
}

function sectionG(doc: TeacherDossierDocument): string {
  const { sessionPlan } = doc;
  if (sessionPlan === null) {
    return `<section class="page"><p class="eyebrow">Section G</p><h1>Conduite du stage</h1><p class="collective">Le plan des 5 séances n'a pas pu être calculé : le pack de ce groupe n'a pas de catalogue de prérequis associé. Le plan de séance devra être arbitré manuellement par l'enseignant.</p>${footer()}</section>`;
  }
  const nonTraite = sessionPlan.nodes.filter((node) => node.profileCounts.NON_TRAITE > 0);
  const sessions = sessionPlan.sessions.map((session) => `<article class="node"><h3>Séance ${session.index} sur 5 — ${session.contentMinutes} min de contenu</h3><table><thead><tr><th>Nœud</th><th>Profil</th><th>Geste</th></tr></thead><tbody>${sessionPlan.nodes.filter((node) => session.nodes.some((segment) => segment.nodeCpsId === node.nodeCpsId)).map((node) => `<tr><td>${text(node.label)}</td><td>${profileBadge(node.profile)}</td><td>${text(node.treatment)}</td></tr>`).join('')}</tbody></table></article>`).join('');
  const warning = sessionPlan.schedulingStatus === 'READY' ? '' : `<p class="collective"><strong>Arbitrage enseignant requis :</strong> ${sessionPlan.schedulingWarnings.map(text).join(' ')}</p>`;
  return `<section class="page"><p class="eyebrow">Section G</p><h1>Conduite du stage</h1>${warning}${sessions}
  <h2>À diagnostiquer en séance 1</h2>${nonTraite.length === 0 ? '<p>Tous les nœuds ont été traités par au moins un élève.</p>' : `<ul>${nonTraite.map((node) => `<li>${text(node.label)} — ${node.profileCounts.NON_TRAITE} élève(s) sans réponse.</li>`).join('')}</ul>`}
  ${footer()}</section>`;
}

export function renderTeacherDossierHtml(doc: TeacherDossierDocument): string {
  const identity = assertRenderIdentity(doc.identity);

  for (const student of doc.students) {
    assertValidTeacherDossierStudentBrief(student);
  }

  const html = `${summaryPage(doc)}${tocPage()}${sectionB(doc)}${sectionC(doc.evidenceCatalog)}${sectionD(doc.students)}${sectionE(doc)}${sectionF(doc)}${sectionG(doc)}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${text(identity.stageLabel)} · DOSSIER ENSEIGNANT</title><style>${styleSheet()}</style></head><body><main class="document" data-audience="STAFF" data-template="${TEACHER_DOSSIER_HTML_VERSION}">${html}</main></body></html>`;
}

export type TeacherDossierPdfResult =
  | Readonly<{ status: 'AVAILABLE'; html: string; pdf: Buffer }>
  | Readonly<{ status: 'UNAVAILABLE'; html: string; errorCode: 'TEACHER_DOSSIER_PDF_RENDER_FAILED' }>;

export async function renderTeacherDossierPdf(
  doc: TeacherDossierDocument,
  dependencies: Readonly<{ renderHtmlToPdf?: (html: string) => Promise<Buffer> }> = {},
): Promise<TeacherDossierPdfResult> {
  const html = renderTeacherDossierHtml(doc);
  try {
    const pdf = await (dependencies.renderHtmlToPdf ?? renderHtmlToPdf)(html);
    if (!pdf.subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('INVALID_PDF_MAGIC');
    return Object.freeze({ status: 'AVAILABLE', html, pdf });
  } catch {
    return Object.freeze({ status: 'UNAVAILABLE', html, errorCode: 'TEACHER_DOSSIER_PDF_RENDER_FAILED' });
  }
}
