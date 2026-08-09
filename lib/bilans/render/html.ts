import type { FactSheet } from '../facts/fact-sheet';
import {
  bilanPackSubjectLabel,
  type BilanPackSubject,
} from '../catalog/subjects';
import { BILAN_PRINT_BRAND, bilanPrintTokenCss } from './brand';
import { buildDeterministicReport } from './report';
import {
  PAPER_ENTRY_DURATION_MEASUREMENT,
  PAPER_ENTRY_DURATION_NOTICE,
} from './passation-presentation';
import type { RenderIdentity } from './render-identity';
import type { ReportAudience } from './profile-copy';
import { bilanPackLevelLabel } from './stage-label';
import { groupDomainsForDisplay, subjectDisplayPolicy } from './subject-display';

export const BILAN_HTML_TEMPLATE_VERSION = 'nexus-bilan-html.v1' as const;

interface Narrative {
  headline: string;
  introduction: string;
  conclusion: string;
  strengths: string[];
  priorities: string[];
  actionPlan: string[];
}

interface RenderDomain {
  id: string;
  narrative: string;
  profileLabel?: string;
  profile?: string;
  score?: number;
}

interface RenderStep {
  domainId: string;
  phaseDidactique: string;
  objectif: string;
  demarche: string;
  seanceLabel: string;
  profileLabel?: string;
  profil?: string;
}

interface RenderContent {
  narrative: Narrative;
  domains: RenderDomain[];
  learningPath: { version: string; steps: RenderStep[] };
  internalFacts?: {
    globalScore: number;
    coverage: number;
    calibrationIndex: number | null;
    domainScores: Array<{ id: string; score: number }>;
  };
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function list(items: readonly string[], className = ''): string {
  return `<ol class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`;
}

function header(identity: RenderIdentity, audience: ReportAudience): string {
  const durationNotice = identity.durationMeasurement === PAPER_ENTRY_DURATION_MEASUREMENT
    ? `<p class="passation-note" style="margin:1.5mm 0 0;color:var(--color-lux-slate);font-size:9pt">${escapeHtml(PAPER_ENTRY_DURATION_NOTICE)}</p>`
    : '';
  return `<header class="report-header">
    <img class="brand-logo" src="${BILAN_PRINT_BRAND.logos.header}" alt="Nexus Réussite">
    <div class="identity"><p class="eyebrow">Bilan ${escapeHtml(audience)}</p><h1>${escapeHtml(identity.stageLabel)}</h1>
    <p><strong>${escapeHtml(identity.displayName)}</strong> · ${escapeHtml(bilanPackLevelLabel(identity.level))} · ${escapeHtml(bilanPackSubjectLabel(identity.subject))} · ${escapeHtml(identity.date)}</p>${durationNotice}</div>
  </header>`;
}

function masteryMap(domains: readonly RenderDomain[]): string {
  const zones = [
    { title: 'Solide et assuré', labels: ['solide'] },
    { title: 'À consolider', labels: ['fragile / à consolider'] },
    { title: 'Repéré et à installer', labels: ['à combler (déjà repéré)'] },
    { title: 'À revoir ou diagnostiquer', labels: ['sûr mais à revoir', 'non évalué'] },
  ];
  return `<div class="mastery-map">${zones.map((zone) => `<section><h3>${zone.title}</h3><p>${domains.filter((domain) => zone.labels.includes(domain.profileLabel ?? '')).map((domain) => escapeHtml(domain.id)).join(' · ') || '—'}</p></section>`).join('')}</div>`;
}

function publicLearningPath(steps: readonly RenderStep[], audience: 'ELEVE' | 'PARENTS'): string {
  const title = audience === 'ELEVE'
    ? 'Ton parcours pendant le stage'
    : 'Le parcours de votre enfant pendant le stage';
  return `<section class="section print-break"><h2>${title}</h2><div class="path">${steps.map((step) => `<article class="path-step"><p class="session">${escapeHtml(step.seanceLabel)} · ${escapeHtml(step.phaseDidactique)}</p><h3>${escapeHtml(step.domainId)}</h3><p><strong>Objectif :</strong> ${escapeHtml(step.objectif)}</p><p><strong>Démarche :</strong> ${escapeHtml(step.demarche)}</p></article>`).join('')}</div></section>`;
}

function publicBody(content: RenderContent, audience: 'ELEVE' | 'PARENTS'): string {
  const student = audience === 'ELEVE';
  const priorityTitle = student ? 'Tes priorités pour le stage' : 'Les priorités du stage';
  return `<main>
    <p class="lead">${escapeHtml(content.narrative.introduction)}</p>
    <section class="section"><h2>${student ? 'Ta carte maîtrise × confiance' : 'Les repères observés'}</h2>${masteryMap(content.domains)}</section>
    <section class="section"><h2>Forces</h2>${list(content.narrative.strengths, 'strengths')}</section>
    <section class="section"><h2>${priorityTitle}</h2>${list(content.narrative.priorities, 'priorities')}</section>
    ${student ? `${publicLearningPath(content.learningPath.steps, audience)}<section class="section"><h2>Ton plan d’action</h2>${list(content.narrative.actionPlan, 'action-plan')}</section>` : `<section class="section print-break"><h2>Comment le diagnostic construit les cinq séances</h2>${list(content.narrative.actionPlan, 'action-plan')}</section>`}
    <section class="closing"><h2>${student ? 'Pour finir' : 'En synthèse'}</h2><p>${escapeHtml(content.narrative.conclusion)}</p></section>
  </main>`;
}

function nexusBody(content: RenderContent, subject: BilanPackSubject): string {
  if (content.internalFacts === undefined) throw new Error('BILAN_HTML_NEXUS_FACTS_MISSING');
  const policy = subjectDisplayPolicy(subject);
  const groups = groupDomainsForDisplay(subject, content.domains);
  const weeks = Array.from({ length: 4 }, (_, index) => content.learningPath.steps.filter((_, stepIndex) => stepIndex % 4 === index));
  const alerts = content.domains.filter(({ profile }) => profile === 'ERREUR_CONFIANTE');
  return `<main>
    <section class="section internal"><h2>Données internes</h2><div class="kpis"><p><strong>Score global</strong><span>${content.internalFacts.globalScore}</span></p><p><strong>Couverture</strong><span>${content.internalFacts.coverage}</span></p><p><strong>Calibration</strong><span>${content.internalFacts.calibrationIndex ?? '—'}</span></p></div></section>
    <section class="section"><h2>Tableau des ${policy.tableNoun}</h2>${groups.map((group) => `<h3>${escapeHtml(group.label)}</h3><table><thead><tr><th>Repère</th><th>Profil</th><th>Score</th></tr></thead><tbody>${group.domains.map((domain) => `<tr><td>${escapeHtml(domain.id)}</td><td>${escapeHtml(domain.profile)}</td><td>${escapeHtml(domain.score)}</td></tr>`).join('')}</tbody></table>`).join('')}</section>
    <section class="section print-break"><h2>Plan sur 4 semaines</h2><div class="weeks">${weeks.map((steps, index) => `<article><h3>Semaine ${index + 1}</h3>${steps.map((step) => `<p>${escapeHtml(step.seanceLabel)} · ${escapeHtml(step.domainId)} · ${escapeHtml(step.phaseDidactique)}</p>`).join('') || '<p>Consolidation et mesure.</p>'}</article>`).join('')}</div></section>
    <section class="section alerts"><h2>Alertes pédagogiques</h2>${alerts.length > 0 ? alerts.map((domain) => `<p><strong>${escapeHtml(domain.id)}</strong> · ERREUR_CONFIANTE</p>`).join('') : '<p>Aucune alerte prioritaire.</p>'}</section>
  </main>`;
}

function styleSheet(): string {
  return `@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.display}';src:url('${BILAN_PRINT_BRAND.fonts.displayAsset}') format('woff2')}@font-face{font-family:'${BILAN_PRINT_BRAND.fonts.body}';src:url('${BILAN_PRINT_BRAND.fonts.bodyAsset}') format('woff2')}
  :root{${bilanPrintTokenCss()}}*{box-sizing:border-box}body{margin:0;background:var(--color-lux-ivory);color:var(--color-lux-ink);font-family:var(--font-dm-sans);font-size:10.5pt;line-height:1.5}.page{width:210mm;min-height:297mm;margin:0 auto;padding:16mm 16mm 18mm;background:var(--color-lux-paper)}h1,h2,h3{font-family:var(--font-fraunces);font-weight:600}h1{font-size:22pt;margin:0 0 2mm}h2{font-size:15pt;border-bottom:1px solid var(--color-lux-gold);padding-bottom:2mm}h3{font-size:11.5pt}.report-header{display:flex;gap:7mm;align-items:center;border-bottom:2px solid var(--color-lux-gold);padding-bottom:6mm}.brand-logo{width:48mm;height:auto}.identity{flex:1}.eyebrow,.session{color:var(--color-lux-gold-deep);font-weight:700;text-transform:uppercase;letter-spacing:.08em}.lead{font-family:var(--font-fraunces);font-size:14pt}.section{margin-top:8mm;break-inside:avoid}.mastery-map,.kpis,.weeks{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm}.mastery-map section,.path-step,.kpis p,.weeks article{border:1px solid var(--color-lux-line);border-radius:3mm;padding:4mm;background:var(--color-lux-white)}.path{display:grid;gap:4mm}.priorities li{border-left:3px solid var(--color-lux-gold);padding-left:3mm;margin-bottom:2mm}.strengths li{color:var(--color-lux-evergreen)}.closing{margin-top:9mm;padding:5mm;background:var(--color-lux-ink);color:var(--color-lux-on-dark)}.closing h2{color:var(--color-lux-gold-bright)}table{width:100%;border-collapse:collapse;margin-bottom:5mm}th,td{text-align:left;padding:2mm;border-bottom:1px solid var(--color-lux-line)}th{color:var(--color-lux-slate)}.kpis p{display:flex;justify-content:space-between}.kpis span{font-family:var(--font-fraunces);font-size:18pt}.footer{display:flex;align-items:center;gap:3mm;margin-top:10mm;padding-top:4mm;border-top:1px solid var(--color-lux-line);color:var(--color-lux-slate)}.footer img{width:9mm;height:9mm}.print-break{break-before:auto}@page{size: A4;margin:0}@media print{body{background:var(--color-lux-white)}.page{margin:0;box-shadow:none}.print-break{break-before:page}}`;
}

export function renderDeterministicBilanHtml(
  factSheet: FactSheet,
  audience: ReportAudience,
  identity: RenderIdentity,
): string {
  const report = buildDeterministicReport(factSheet, audience, identity);
  const content = report.content as unknown as RenderContent;
  const body = audience === 'NEXUS'
    ? nexusBody(content, identity.subject)
    : publicBody(content, audience);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(identity.stageLabel)} · ${escapeHtml(audience)}</title><style>${styleSheet()}</style></head><body><article class="page" data-audience="${audience}" data-template="${BILAN_HTML_TEMPLATE_VERSION}">${header(identity, audience)}${body}<footer class="footer"><img src="${BILAN_PRINT_BRAND.logos.compact}" alt=""><span>Nexus Réussite · Document pédagogique confidentiel</span></footer></article></body></html>`;
}
