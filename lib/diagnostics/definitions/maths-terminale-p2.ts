/**
 * DiagnosticDefinition — Maths Terminale Spécialité, Pallier 2
 * Version: v1.3 — Domains loaded from compiled JSON (CdC §3.2)
 */

import type { DiagnosticDefinition, ChapterDefinition } from '../types';
import compiledDomains from './generated/maths-terminale-p2.domains.json';

/** Build skills record from compiled domains */
function buildSkills(): Record<string, { skillId: string; label: string; domain: string }[]> {
  const skills: Record<string, { skillId: string; label: string; domain: string }[]> = {};
  for (const domain of compiledDomains.domains) {
    skills[domain.domainId] = domain.skills.map((s) => ({
      skillId: s.skillId,
      label: s.skillLabel,
      domain: domain.domainId,
    }));
  }
  return skills;
}

/** Build domain weights from compiled domains */
function buildWeights(): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const domain of compiledDomains.domains) {
    weights[domain.domainId] = domain.weight;
  }
  return weights;
}

export const MATHS_TERMINALE_P2: DiagnosticDefinition = {
  key: 'maths-terminale-p2',
  version: 'v1.3',
  label: compiledDomains.label,
  track: 'maths',
  level: 'terminale',
  stage: 'pallier2',

  skills: buildSkills(),
  chapters: (compiledDomains.chapters ?? []) as ChapterDefinition[],

  scoringPolicy: {
    domainWeights: buildWeights(),
    thresholds: {
      confirmed: { readiness: 55, risk: 60 },
      conditional: { readiness: 45, risk: 75 },
    },
  },

  prompts: {
    version: 'v1.0',
    eleve: `Tu es un expert pédagogique bienveillant en mathématiques (Terminale spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère un bilan personnalisé pour l'ÉLÈVE en Markdown.

## Règles strictes
- Ton : bienveillant, direct, motivant. Tutoiement.
- Ne JAMAIS inventer de données, ressources ou exigences du programme.
- Si du contexte pédagogique RAG est fourni, le citer (ex: "Conformément au programme…").
- Si une donnée est manquante ou "not_studied", dire "à planifier" et non "faiblesse".
- Toujours expliquer POURQUOI une priorité est importante (impact BAC, orientation post-bac).
- Focus Terminale : limites, continuité, logarithme, intégrales, complexes, récurrence.

## Structure obligatoire
1. **Résumé 15 secondes** : 3 puces (force, priorité, objectif 2 semaines)
2. **Score & lecture** : explication simple du niveau + NA assumés
3. **Tes 3 priorités** : avec micro-exercice concret 5 min chacun
4. **Plan 2 semaines** : routine quotidienne + checkpoints mesurables
5. **Conseil de méthode** : adapté au style d'apprentissage et réflexe blocage
6. **Message motivation** : sobre, pas de lyrisme

~400 mots. Retourne UNIQUEMENT le Markdown.`,

    parents: `Tu es un expert pédagogique professionnel en mathématiques (Terminale spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère un rapport pour les PARENTS en Markdown.

## Règles strictes
- Ton : professionnel, rassurant, transparent. Vouvoiement.
- Ne JAMAIS exposer les scores bruts — utiliser des termes qualitatifs.
- Ne JAMAIS inventer de données ou de ressources.
- "not_studied" = "sera abordé prochainement", pas une faiblesse.
- Contexte Terminale : épreuve BAC en mars, enjeux orientation Parcoursup.

## Structure obligatoire
1. **Synthèse** : où en est l'élève dans la préparation BAC
2. **Risques** : stress/temps/automatismes expliqués sans dramatiser
3. **Plan réaliste maison** : 20-30 min/jour, comment aider sans faire à la place
4. **Ce que Nexus va faire** : promesse opérationnelle concrète
5. **Indicateurs de progrès** : mesurables

~500 mots. Retourne UNIQUEMENT le Markdown.`,

    nexus: `Tu es un expert pédagogique technique en mathématiques (Terminale spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère une fiche pédagogique pour l'ÉQUIPE NEXUS en Markdown.

## Règles strictes
- Ton : technique, factuel.
- Citer les sources RAG avec chunk ID si disponibles.
- Signaler les incohérences dans les données.
- Distinguer "not_studied" de "unknown".
- Focus Terminale : prioriser intégrales, limites, log, complexes pour le BAC.

## Structure obligatoire
1. **DataQuality / Coverage / Incohérences**
2. **Forces / Faiblesses** : avec preuves (scores + verbatims)
3. **Programme personnalisé** : blocs de séances, objectifs par séance
4. **Recommandation stage** : grouping profil A/B/C
5. **Alertes** : avec impact et action requise

~600 mots. Tableaux markdown. Retourne UNIQUEMENT le Markdown.`,
  },

  ragPolicy: {
    collections: ['ressources_pedagogiques_terminale'],
    maxQueries: 4,
    topK: 2,
  },

  riskModel: {
    factors: ['Abstraction', 'Gestion du temps', 'Démonstration', 'Rigueur rédactionnelle', 'Stress'],
  },

  examFormat: {
    duration: 240,
    calculatorAllowed: true,
    structure: '5-7 exercices, 20 pts total',
    totalPoints: 20,
  },
};
