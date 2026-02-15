/**
 * DiagnosticDefinition — NSI Terminale Spécialité, Pallier 2
 * Version: v1.3 — Domains loaded from compiled JSON (CdC §3.4)
 */

import type { DiagnosticDefinition } from '../types';
import compiledDomains from './generated/nsi-terminale-p2.domains.json';

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

export const NSI_TERMINALE_P2: DiagnosticDefinition = {
  key: 'nsi-terminale-p2',
  version: 'v1.3',
  label: compiledDomains.label,
  track: 'nsi',
  level: 'terminale',
  stage: 'pallier2',

  skills: buildSkills(),

  scoringPolicy: {
    domainWeights: buildWeights(),
    thresholds: {
      confirmed: { readiness: 50, risk: 65 },
      conditional: { readiness: 40, risk: 78 },
    },
  },

  prompts: {
    version: 'v1.0',
    eleve: `Tu es un expert pédagogique bienveillant en NSI (Terminale spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère un bilan personnalisé pour l'ÉLÈVE en Markdown.

## Règles strictes
- Ton : bienveillant, direct, motivant. Tutoiement.
- Ne JAMAIS inventer de données, ressources ou exigences du programme.
- Focus NSI Tle : structures de données (arbres, graphes, piles/files), SQL, récursivité, POO.

## Structure obligatoire
1. **Résumé 15 secondes** : 3 puces (force, priorité, objectif 2 semaines)
2. **Score & lecture** : explication simple du niveau
3. **Tes 3 priorités** : avec micro-exercice concret (implémentation pile, requête SQL, parcours graphe)
4. **Plan 2 semaines** : routine quotidienne + checkpoints mesurables
5. **Conseil de méthode** : adapté au style d'apprentissage
6. **Message motivation** : sobre, pas de lyrisme

~400 mots. Retourne UNIQUEMENT le Markdown.`,

    parents: `Tu es un expert pédagogique professionnel en NSI (Terminale spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère un rapport pour les PARENTS en Markdown.

## Règles strictes
- Ton : professionnel, rassurant, transparent. Vouvoiement.
- Ne JAMAIS exposer les scores bruts — utiliser des termes qualitatifs.
- Contexte Terminale NSI : épreuve BAC pratique + écrit, enjeux Parcoursup (prépas, écoles d'ingé).

## Structure obligatoire
1. **Synthèse** : où en est l'élève dans la préparation BAC NSI
2. **Risques** : abstraction des structures, SQL, complexité algorithmique
3. **Plan réaliste maison** : 20-30 min/jour de pratique code
4. **Ce que Nexus va faire** : promesse opérationnelle concrète
5. **Indicateurs de progrès** : mesurables

~500 mots. Retourne UNIQUEMENT le Markdown.`,

    nexus: `Tu es un expert pédagogique technique en NSI (Terminale spécialité, programme français).
Tu travailles pour Nexus Réussite, centre de soutien scolaire en Tunisie.

Génère une fiche pédagogique pour l'ÉQUIPE NEXUS en Markdown.

## Règles strictes
- Ton : technique, factuel.
- Citer les sources RAG avec chunk ID si disponibles.
- Focus NSI Tle : structures de données, SQL, récursivité, POO, complexité.

## Structure obligatoire
1. **DataQuality / Coverage / Incohérences**
2. **Forces / Faiblesses** : avec preuves
3. **Programme personnalisé** : blocs de séances
4. **Recommandation stage** : grouping profil A/B/C
5. **Alertes** : avec impact et action requise

~600 mots. Tableaux markdown. Retourne UNIQUEMENT le Markdown.`,
  },

  ragPolicy: {
    collections: ['ressources_pedagogiques_nsi_terminale'],
    maxQueries: 4,
    topK: 2,
  },

  riskModel: {
    factors: ['Abstraction des structures', 'SQL', 'Complexité algorithmique', 'Capacité debug', 'Compréhension invariants'],
  },

  examFormat: {
    duration: 210,
    calculatorAllowed: false,
    structure: '3h30 écrit + 1h épreuve pratique',
    totalPoints: 20,
  },
};
