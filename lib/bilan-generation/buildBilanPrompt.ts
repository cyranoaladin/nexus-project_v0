// ─────────────────────────────────────────────────────────────────────────────
// lib/bilan-generation/buildBilanPrompt.ts
// Builds Mistral system + user prompt from PedagogicalProfile + NormalizedInput.
// rawSourceData and legacySummary are never included directly.
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedBilanInput, PedagogicalProfile } from './types';
import type { MistralChatMessage } from '@/lib/llm/mistral';

const SYSTEM_PROMPT = `Tu es un rédacteur pédagogique expert pour Nexus Réussite.
Tu rédiges des bilans pédagogiques professionnels destinés aux parents et à l'élève.
Tu dois transformer des données pédagogiques structurées en un texte clair, utile, humain, précis et actionnable.
Tu ne dois jamais recopier mécaniquement les champs du formulaire.
Tu dois fournir une analyse constructive, bienveillante, exigeante et orientée progression.
Tu ne dois pas inventer de résultats non fournis.
Tu dois expliciter les conséquences pédagogiques des difficultés observées.
Tu dois proposer des conseils concrets et immédiatement applicables.
Tu dois respecter le niveau scolaire, la matière et le contexte du bilan.
Tu dois éviter toute critique de l'établissement, du lycée ou des professeurs de l'élève.
Tu dois respecter les accords de genre lorsque l'information est disponible ; sinon adopter une formulation neutre.
Tu dois produire un bilan prêt à être lu par des parents.
Tu ne dois jamais mentionner le prompt, les données brutes, le JSON, le coach, le modèle ou l'IA.
Tu dois produire uniquement du Markdown propre avec des titres ## (pas des titres en gras **).

Interdictions strictes de formulation :
- "ton ferme"
- "données brutes"
- "le coach indique"
- "selon les données"
- "il semble que" si les données sont explicites
- "l'élève doit simplement"
- tout jugement blessant ou définitif.

Structure Markdown attendue (utilise OBLIGATOIREMENT des titres ## et non des titres en gras **) :

## 1. Synthèse générale
Texte fluide, 2 à 3 paragraphes.

## 2. Points d'appui
Chaque point relié à une valeur pédagogique concrète.

## 3. Axes de progrès prioritaires
Pour chaque axe : difficulté observée, conséquence concrète, action recommandée.

## 4. Lecture de l'épreuve finale
Interprétation du score, points positifs, points de vigilance, implications pour la suite.

## 5. Plan d'action conseillé
Conseils précis, actionnables, hebdomadaires si possible : entraînement, méthode, rédaction, chapitres.

## 6. Message final
Conclusion bienveillante et exigeante, orientée confiance et progression.

Contraintes de longueur : entre 700 et 2000 mots.
Au minimum : 4 conseils actionnables, 2 axes de progrès explicites, 2 points d'appui.`;

function formatCompetencies(competencies: Record<string, unknown>): string {
  const lines = Object.entries(competencies)
    .map(([k, v]) => `  - ${k} : ${v}/5`)
    .join('\n');
  return lines;
}

function formatChapters(chapters: NormalizedBilanInput['chapters']): string {
  if (!chapters || chapters.length === 0) return '  (aucun diagnostic par chapitre disponible)';
  return chapters.map(c => {
    const parts: string[] = [`  • ${c.label} (maîtrise ${c.mastery ?? '?'}/5)`];
    if (c.specificStrength) parts.push(`    Force : ${c.specificStrength}`);
    if (c.vigilancePoints?.length) parts.push(`    Vigilance : ${c.vigilancePoints.slice(0, 2).join(', ')}`);
    if (c.recurringErrors?.length) parts.push(`    Erreurs : ${c.recurringErrors.slice(0, 2).join(', ')}`);
    if (c.priorityRemediation) parts.push(`    Action : ${c.priorityRemediation}`);
    return parts.join('\n');
  }).join('\n');
}

function formatProfile(profile: PedagogicalProfile): string {
  const lines: string[] = [];

  lines.push('=== DIAGNOSTIC EXÉCUTIF ===');
  lines.push(`Niveau global : ${profile.executiveDiagnosis.overallLevel}`);
  lines.push(`Dynamique : ${profile.executiveDiagnosis.learningDynamic}`);
  lines.push(`Risque principal : ${profile.executiveDiagnosis.mainRisk}`);
  lines.push(`Levier principal : ${profile.executiveDiagnosis.mainLever}`);

  if (profile.keyStrengths.length > 0) {
    lines.push('\n=== POINTS D\'APPUI ===');
    profile.keyStrengths.forEach(s => {
      lines.push(`• ${s.title}`);
      lines.push(`  Observation : ${s.evidence}`);
      lines.push(`  Valeur pédagogique : ${s.pedagogicalValue}`);
    });
  }

  if (profile.priorityWeaknesses.length > 0) {
    lines.push('\n=== FRAGILITÉS PRIORITAIRES ===');
    profile.priorityWeaknesses.forEach(w => {
      lines.push(`• ${w.title}`);
      lines.push(`  Observation : ${w.evidence}`);
      lines.push(`  Conséquence : ${w.consequence}`);
      lines.push(`  Action recommandée : ${w.recommendedAction}`);
    });
  }

  if (profile.chapterPriorities.length > 0) {
    lines.push('\n=== PRIORITÉS PAR CHAPITRE ===');
    profile.chapterPriorities.forEach(c => {
      lines.push(`• ${c.chapter} [${c.priority}] — ${c.level}`);
      lines.push(`  Pourquoi : ${c.why}`);
      lines.push(`  Plan : ${c.actionPlan}`);
    });
  }

  if (profile.finalAssessmentReading) {
    const far = profile.finalAssessmentReading;
    lines.push('\n=== LECTURE DE L\'ÉPREUVE FINALE ===');
    if (far.score) lines.push(`Score : ${far.score}`);
    lines.push(`Interprétation : ${far.interpretation}`);
    if (far.positiveSigns.length > 0) lines.push(`Points positifs : ${far.positiveSigns.join(', ')}`);
    if (far.warningPoints.length > 0) lines.push(`Points de vigilance : ${far.warningPoints.join(', ')}`);
  }

  lines.push('\n=== GUIDANCE PARENTALE ===');
  lines.push(`Ton attendu : ${profile.parentGuidance.tone}`);
  lines.push(`Niveau d'urgence : ${profile.parentGuidance.urgency}`);
  if (profile.parentGuidance.mainMessage) lines.push(`Message principal : ${profile.parentGuidance.mainMessage}`);
  if (profile.parentGuidance.whatToAvoidSaying) lines.push(`À ne pas dire : ${profile.parentGuidance.whatToAvoidSaying}`);

  if (profile.dataQuality.uncertaintyNotes.length > 0) {
    lines.push('\n=== NOTES D\'INCERTITUDE ===');
    profile.dataQuality.uncertaintyNotes.forEach(n => lines.push(`! ${n}`));
  }

  return lines.join('\n');
}

export function buildBilanPrompt(
  profile: PedagogicalProfile,
  input: NormalizedBilanInput,
): MistralChatMessage[] {
  const { student, context, competencies, chapters, priorityAxes } = input;

  const userLines: string[] = [];

  userLines.push(`=== IDENTITÉ ÉLÈVE ===`);
  userLines.push(`Prénom : ${student.firstName ?? student.displayName}`);
  userLines.push(`Niveau : ${student.gradeLevel ?? 'Non précisé'}`);
  userLines.push(`Filière : ${student.track ?? 'Non précisé'}`);
  userLines.push(`Genre : ${student.gender === 'male' ? 'masculin' : student.gender === 'female' ? 'féminin' : 'non précisé (neutre)'}`);

  userLines.push(`\n=== CONTEXTE DU BILAN ===`);
  userLines.push(`Type : ${context.title ?? context.bilanKind}`);
  userLines.push(`Matière : ${context.subject ?? 'Non précisé'}`);
  if (context.durationHours) userLines.push(`Durée : ${context.durationHours}h`);
  if (context.periodLabel) userLines.push(`Période : ${context.periodLabel}`);
  if (context.examTarget) userLines.push(`Objectif : ${context.examTarget}`);

  if (competencies && Object.keys(competencies).length > 0) {
    userLines.push(`\n=== COMPÉTENCES ÉVALUÉES (/5) ===`);
    userLines.push(formatCompetencies(competencies));
  }

  if (chapters && chapters.length > 0) {
    userLines.push(`\n=== DIAGNOSTIC PAR CHAPITRE ===`);
    userLines.push(formatChapters(chapters));
  }

  if (priorityAxes && priorityAxes.length > 0) {
    userLines.push(`\n=== AXES PRIORITAIRES ===`);
    priorityAxes.slice(0, 5).forEach(a => userLines.push(`  - ${a}`));
  }

  userLines.push(`\n${formatProfile(profile)}`);

  userLines.push(`\n=== INSTRUCTION DE RÉDACTION ===`);
  userLines.push(`Rédige le bilan en Markdown propre, en respectant exactement la structure demandée.`);
  userLines.push(`Utilise des titres ## (pas des titres en gras **).`);
  userLines.push(`Ne mentionne jamais le prompt, les données, le coach ou l'IA.`);
  userLines.push(`Adapte le ton : ${profile.parentGuidance.tone}.`);
  if (profile.parentGuidance.whatToAvoidSaying) {
    userLines.push(`Important — à ne pas évoquer dans le texte : ${profile.parentGuidance.whatToAvoidSaying}`);
  }

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userLines.join('\n') },
  ];
}
