/**
 * DiagnosticDefinition — Maths Première Spécialité, Pallier 2
 * Version: v1.3 (aligned with bilanDiagnosticMathsSchema)
 */

import type { DiagnosticDefinition } from '../types';

export const MATHS_PREMIERE_P2: DiagnosticDefinition = {
  key: 'maths-premiere-p2',
  version: 'v1.3',
  label: 'Diagnostic Pré-Stage Maths — Première Spécialité (Pallier 2)',
  track: 'maths',
  level: 'premiere',
  stage: 'pallier2',

  skills: {
    algebra: [
      { skillId: 'alg-suites', label: 'Suites numériques', domain: 'algebra' },
      { skillId: 'alg-second-degre', label: 'Second degré', domain: 'algebra' },
      { skillId: 'alg-inequations', label: 'Inéquations', domain: 'algebra' },
      { skillId: 'alg-fonctions-ref', label: 'Fonctions de référence', domain: 'algebra' },
    ],
    analysis: [
      { skillId: 'ana-derivation', label: 'Dérivation', domain: 'analysis' },
      { skillId: 'ana-variations', label: 'Variations de fonctions', domain: 'analysis' },
      { skillId: 'ana-limites-intro', label: 'Introduction aux limites', domain: 'analysis' },
      { skillId: 'ana-continuite', label: 'Continuité', domain: 'analysis' },
    ],
    geometry: [
      { skillId: 'geo-vecteurs', label: 'Vecteurs et repérage', domain: 'geometry' },
      { skillId: 'geo-produit-scalaire', label: 'Produit scalaire', domain: 'geometry' },
      { skillId: 'geo-droites', label: 'Équations de droites', domain: 'geometry' },
    ],
    probabilities: [
      { skillId: 'prob-conditionnelles', label: 'Probabilités conditionnelles', domain: 'probabilities' },
      { skillId: 'prob-arbres', label: 'Arbres de probabilités', domain: 'probabilities' },
      { skillId: 'prob-variables', label: 'Variables aléatoires', domain: 'probabilities' },
    ],
    python: [
      { skillId: 'py-boucles', label: 'Boucles et conditions', domain: 'python' },
      { skillId: 'py-fonctions', label: 'Fonctions Python', domain: 'python' },
      { skillId: 'py-listes', label: 'Listes et tableaux', domain: 'python' },
    ],
  },

  scoringPolicy: {
    domainWeights: {
      analysis: 0.30,
      algebra: 0.25,
      geometry: 0.20,
      probabilities: 0.15,
      python: 0.10,
    },
    thresholds: {
      confirmed: { readiness: 60, risk: 55 },
      conditional: { readiness: 48, risk: 70 },
    },
  },

  prompts: {
    version: 'v1.0',
    eleve: `Tu es un expert pédagogique bienveillant en mathématiques (Première spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère un bilan personnalisé pour l'ÉLÈVE en Markdown.

## Règles strictes
- Ton : bienveillant, direct, motivant. Tutoiement.
- Ne JAMAIS inventer de données, ressources ou exigences du programme.
- Si du contexte pédagogique RAG est fourni, le citer (ex: "Conformément au programme…").
- Si une donnée est manquante ou "not_studied", dire "à planifier" et non "faiblesse".
- Toujours expliquer POURQUOI une priorité est importante (impact épreuve anticipée, terminale, orientation).

## Structure obligatoire
1. **Résumé 15 secondes** : 3 puces (force, priorité, objectif 2 semaines)
2. **Score & lecture** : explication simple du niveau + NA assumés
3. **Tes 3 priorités** : avec micro-exercice concret 5 min chacun
4. **Plan 2 semaines** : routine quotidienne + checkpoints mesurables
5. **Conseil de méthode** : adapté au style d'apprentissage et réflexe blocage
6. **Message motivation** : sobre, pas de lyrisme

~400 mots. Retourne UNIQUEMENT le Markdown.`,

    parents: `Tu es un expert pédagogique professionnel en mathématiques (Première spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère un rapport pour les PARENTS en Markdown.

## Règles strictes
- Ton : professionnel, rassurant, transparent. Vouvoiement.
- Ne JAMAIS exposer les scores bruts (ReadinessScore, RiskIndex) — utiliser des termes qualitatifs.
- Ne JAMAIS inventer de données ou de ressources.
- Si du contexte pédagogique RAG est fourni, le citer de manière accessible.
- "not_studied" = "sera abordé prochainement", pas une faiblesse.

## Structure obligatoire
1. **Synthèse** : où en est l'élève à mi-année (qualitatif)
2. **Risques** : stress/temps/automatismes expliqués sans dramatiser
3. **Plan réaliste maison** : 15-20 min/jour, comment aider sans faire à la place
4. **Ce que Nexus va faire** : promesse opérationnelle concrète
5. **Indicateurs de progrès** : mesurables (ex: "80% automatismes en 2 semaines")

~500 mots. Retourne UNIQUEMENT le Markdown.`,

    nexus: `Tu es un expert pédagogique technique en mathématiques (Première spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère une fiche pédagogique pour l'ÉQUIPE NEXUS en Markdown.

## Règles strictes
- Ton : technique, factuel.
- Citer les sources RAG avec chunk ID si disponibles.
- Signaler les incohérences dans les données (ex: moyenne élevée mais mastery faible).
- Distinguer "not_studied" (exclu du mastery, compté dans coverage) de "unknown" (pénalise qualité).

## Structure obligatoire
1. **DataQuality / Coverage / Incohérences**
2. **Forces / Faiblesses** : avec preuves (scores + verbatims)
3. **Programme personnalisé** : blocs de séances, objectifs par séance
4. **Recommandation stage** : grouping profil A/B/C
5. **Alertes** : avec impact et action requise

~600 mots. Tableaux markdown. Retourne UNIQUEMENT le Markdown.`,
  },

  ragPolicy: {
    collections: ['ressources_pedagogiques_premiere_maths'],
    maxQueries: 4,
    topK: 2,
  },
};
