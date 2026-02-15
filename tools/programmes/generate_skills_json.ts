#!/usr/bin/env ts-node
/**
 * CdC §4.1 — Generate skills.generated.json for each programme.
 *
 * In production, this would extract from PDFs via heuristics.
 * For now, we generate from the curated skills-data.ts as the
 * "extracted candidates" — the mapping YAML layer will stabilize IDs.
 *
 * Usage:
 *   npx ts-node tools/programmes/generate_skills_json.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { ProgrammeCandidates, ProgrammeKey, SkillCandidate } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Skill definitions from the existing curated data */
const PROGRAMMES: Record<ProgrammeKey, {
  sections: Array<{
    rawTitle: string;
    normalizedTitle: string;
    domainId: string;
    skills: Array<{ id: string; label: string }>;
  }>;
}> = {
  maths_premiere: {
    sections: [
      {
        rawTitle: 'Algèbre',
        normalizedTitle: 'Algèbre & Suites',
        domainId: 'algebra',
        skills: [
          { id: 'ALG_SUITE_ARITH', label: 'Suites arithmétiques (u_n, somme)' },
          { id: 'ALG_SUITE_GEO', label: 'Suites géométriques (u_n, somme)' },
          { id: 'ALG_SUITE_VARIATION', label: "Variation d'une suite" },
          { id: 'ALG_SUITE_CONV', label: 'Convergence/divergence' },
          { id: 'ALG_MODEL_EXP', label: 'Modélisation exponentielle' },
          { id: 'ALG_QUADRATIC_EQ', label: 'Second degré (équations)' },
          { id: 'ALG_QUADRATIC_CANON', label: 'Forme canonique' },
          { id: 'ALG_FACTORIZATION', label: 'Factorisations stratégiques' },
        ],
      },
      {
        rawTitle: 'Analyse',
        normalizedTitle: 'Analyse & Dérivation',
        domainId: 'analysis',
        skills: [
          { id: 'ANA_DERIV_DEF', label: 'Nombre dérivé (sens + calcul)' },
          { id: 'ANA_DERIV_RULES', label: 'Règles de dérivation' },
          { id: 'ANA_DERIV_CHAIN', label: 'Dérivation composées' },
          { id: 'ANA_VARIATIONS', label: 'Tableau de variations' },
          { id: 'ANA_OPTIMIZATION', label: 'Extremum/optimisation' },
          { id: 'ANA_EXP', label: 'Exponentielle' },
          { id: 'ANA_TRIG', label: 'Trigonométrie' },
        ],
      },
      {
        rawTitle: 'Géométrie',
        normalizedTitle: 'Géométrie',
        domainId: 'geometry',
        skills: [
          { id: 'GEO_DOT_PRODUCT', label: 'Produit scalaire' },
          { id: 'GEO_AL_KASHI', label: 'Al-Kashi' },
          { id: 'GEO_MEDIAN_FORMULA', label: 'Formule de la médiane' },
          { id: 'GEO_ORTHOGONALITY', label: 'Orthogonalité' },
          { id: 'GEO_LINE_EQUATION', label: 'Équation de droite' },
          { id: 'GEO_CIRCLE_EQUATION', label: 'Équation de cercle' },
          { id: 'GEO_PROJECTION', label: 'Projeté orthogonal' },
          { id: 'GEO_DISTANCE_POINT_LINE', label: 'Distance point-droite' },
        ],
      },
      {
        rawTitle: 'Probabilités et statistiques',
        normalizedTitle: 'Probabilités',
        domainId: 'probabilities',
        skills: [
          { id: 'PROB_CONDITIONAL', label: 'Conditionnelles P_A(B)' },
          { id: 'PROB_INDEPENDENCE', label: 'Indépendance' },
          { id: 'PROB_TREE', label: 'Arbre pondéré' },
          { id: 'PROB_TOTAL', label: 'Probabilités totales' },
          { id: 'PROB_RANDOM_VAR', label: 'Variable aléatoire/espérance' },
        ],
      },
      {
        rawTitle: 'Algorithmique et programmation',
        normalizedTitle: 'Python & Algorithmique',
        domainId: 'python',
        skills: [
          { id: 'PY_FUNC', label: 'Fonctions Python' },
          { id: 'PY_LOOPS', label: 'Boucles for/while' },
          { id: 'PY_LISTS', label: 'Listes' },
          { id: 'PY_SEQ_SIM', label: 'Suites algorithmique' },
          { id: 'PY_MONTE_CARLO', label: 'Simulation Monte-Carlo' },
        ],
      },
    ],
  },

  maths_terminale: {
    sections: [
      {
        rawTitle: 'Algèbre',
        normalizedTitle: 'Algèbre & Complexes',
        domainId: 'algebra',
        skills: [
          { id: 'ALG_SUITE_ARITH', label: 'Suites arithmétiques (u_n, somme)' },
          { id: 'ALG_SUITE_GEO', label: 'Suites géométriques (u_n, somme)' },
          { id: 'ALG_SUITE_VARIATION', label: "Variation d'une suite" },
          { id: 'ALG_SUITE_CONV', label: 'Convergence/divergence' },
          { id: 'ALG_MODEL_EXP', label: 'Modélisation exponentielle' },
          { id: 'ALG_QUADRATIC_EQ', label: 'Second degré (équations)' },
          { id: 'ALG_QUADRATIC_CANON', label: 'Forme canonique' },
          { id: 'ALG_FACTORIZATION', label: 'Factorisations stratégiques' },
          { id: 'TLE_COMPLEX', label: 'Nombres complexes' },
          { id: 'TLE_RECURRENCE', label: 'Récurrence' },
          { id: 'TLE_SUMS', label: 'Sommes/séries' },
        ],
      },
      {
        rawTitle: 'Analyse',
        normalizedTitle: 'Analyse & Éq. Diff',
        domainId: 'analysis',
        skills: [
          { id: 'ANA_DERIV_DEF', label: 'Nombre dérivé (sens + calcul)' },
          { id: 'ANA_DERIV_RULES', label: 'Règles de dérivation' },
          { id: 'ANA_DERIV_CHAIN', label: 'Dérivation composées' },
          { id: 'ANA_VARIATIONS', label: 'Tableau de variations' },
          { id: 'ANA_OPTIMIZATION', label: 'Extremum/optimisation' },
          { id: 'ANA_EXP', label: 'Exponentielle' },
          { id: 'ANA_TRIG', label: 'Trigonométrie' },
          { id: 'TLE_LIMITS', label: 'Limites & continuité' },
          { id: 'TLE_LOG', label: 'Logarithme ln' },
          { id: 'TLE_DERIV_ADV', label: 'Dérivation avancée' },
          { id: 'TLE_INTEGRATION', label: 'Primitives/intégrales' },
        ],
      },
      {
        rawTitle: 'Géométrie',
        normalizedTitle: 'Géométrie Espace',
        domainId: 'geometry',
        skills: [
          { id: 'GEO_DOT_PRODUCT', label: 'Produit scalaire' },
          { id: 'GEO_AL_KASHI', label: 'Al-Kashi' },
          { id: 'GEO_ORTHOGONALITY', label: 'Orthogonalité' },
          { id: 'GEO_LINE_EQUATION', label: 'Équation de droite' },
          { id: 'GEO_CIRCLE_EQUATION', label: 'Équation de cercle' },
          { id: 'GEO_PROJECTION', label: 'Projeté orthogonal' },
          { id: 'TLE_SPACE_GEO', label: 'Géométrie 3D' },
        ],
      },
      {
        rawTitle: 'Probabilités et statistiques',
        normalizedTitle: 'Probabilités',
        domainId: 'probabilities',
        skills: [
          { id: 'PROB_CONDITIONAL', label: 'Conditionnelles P_A(B)' },
          { id: 'PROB_INDEPENDENCE', label: 'Indépendance' },
          { id: 'PROB_TREE', label: 'Arbre pondéré' },
          { id: 'PROB_TOTAL', label: 'Probabilités totales' },
          { id: 'PROB_RANDOM_VAR', label: 'Variable aléatoire/espérance' },
          { id: 'TLE_BINOMIAL', label: 'Loi binomiale approfondie' },
        ],
      },
      {
        rawTitle: 'Algorithmique et programmation',
        normalizedTitle: 'Python & Algorithmique',
        domainId: 'python',
        skills: [
          { id: 'PY_FUNC', label: 'Fonctions Python' },
          { id: 'PY_LOOPS', label: 'Boucles for/while' },
          { id: 'PY_LISTS', label: 'Listes' },
          { id: 'PY_SEQ_SIM', label: 'Suites algorithmique' },
          { id: 'PY_MONTE_CARLO', label: 'Simulation Monte-Carlo' },
        ],
      },
    ],
  },

  nsi_premiere: {
    sections: [
      {
        rawTitle: 'Représentation des données',
        normalizedTitle: 'Données & Types',
        domainId: 'data_representation',
        skills: [
          { id: 'NSI_TYPES', label: 'Types de base & construits' },
          { id: 'NSI_TRUTH_TABLE', label: 'Tables de vérité / Booléens' },
          { id: 'NSI_BINARY', label: 'Représentation binaire/héxa' },
          { id: 'NSI_CSV', label: 'Traitement de données (CSV)' },
        ],
      },
      {
        rawTitle: 'Algorithmique',
        normalizedTitle: 'Algorithmique',
        domainId: 'algorithms',
        skills: [
          { id: 'NSI_COMPLEXITY', label: 'Complexité algorithmique' },
          { id: 'NSI_SORT', label: 'Algorithmes de tri' },
          { id: 'NSI_KNN', label: 'k-plus proches voisins' },
          { id: 'NSI_GREEDY', label: 'Algorithmes gloutons' },
        ],
      },
      {
        rawTitle: 'Architectures matérielles et OS',
        normalizedTitle: 'Architecture & OS',
        domainId: 'systems_architecture',
        skills: [
          { id: 'NSI_VON_NEUMANN', label: 'Architecture Von Neumann' },
          { id: 'NSI_PROCESSES', label: 'Processus & OS' },
          { id: 'NSI_NETWORK_PROTO', label: 'Protocoles réseau (TCP/IP)' },
          { id: 'NSI_ROUTING', label: 'Routage & IHM Web' },
        ],
      },
      {
        rawTitle: 'Langages et programmation',
        normalizedTitle: 'Langage Python',
        domainId: 'python_programming',
        skills: [
          { id: 'NSI_PY_FUNCTIONS', label: 'Fonctions & Spécifications' },
          { id: 'NSI_PY_TESTS', label: 'Tests & Assertions' },
          { id: 'NSI_PY_MODULES', label: 'Modules & Bibliothèques' },
          { id: 'NSI_PY_RECURSION', label: 'Récursivité (Intro)' },
        ],
      },
    ],
  },

  nsi_terminale: {
    sections: [
      {
        rawTitle: 'Structures de données',
        normalizedTitle: 'Structures de Données',
        domainId: 'data_structures',
        skills: [
          { id: 'NSI_TYPES', label: 'Types de base & construits' },
          { id: 'NSI_TRUTH_TABLE', label: 'Tables de vérité / Booléens' },
          { id: 'NSI_BINARY', label: 'Représentation binaire/héxa' },
          { id: 'NSI_CSV', label: 'Traitement de données (CSV)' },
          { id: 'NSI_TREES', label: 'Arbres binaires' },
          { id: 'NSI_GRAPHS', label: 'Graphes (DFS/BFS)' },
          { id: 'NSI_STACKS_QUEUES', label: 'Piles & Files' },
        ],
      },
      {
        rawTitle: 'Algorithmique avancée',
        normalizedTitle: 'Algo Avancée',
        domainId: 'algorithmic_advanced',
        skills: [
          { id: 'NSI_COMPLEXITY', label: 'Complexité algorithmique' },
          { id: 'NSI_SORT', label: 'Algorithmes de tri' },
          { id: 'NSI_KNN', label: 'k-plus proches voisins' },
          { id: 'NSI_GREEDY', label: 'Algorithmes gloutons' },
          { id: 'NSI_DIVIDE_CONQUER', label: 'Diviser pour régner' },
          { id: 'NSI_DYNAMIC_PROG', label: 'Programmation dynamique' },
        ],
      },
      {
        rawTitle: 'Bases de données',
        normalizedTitle: 'Bases de Données',
        domainId: 'databases',
        skills: [
          { id: 'NSI_SQL', label: 'Bases de données SQL' },
          { id: 'NSI_SQL_JOIN', label: 'Requêtes JOIN' },
          { id: 'NSI_RELATIONAL', label: 'Modèle relationnel' },
        ],
      },
      {
        rawTitle: 'Architectures et réseaux',
        normalizedTitle: 'Archi & Réseaux',
        domainId: 'networks',
        skills: [
          { id: 'NSI_VON_NEUMANN', label: 'Architecture Von Neumann' },
          { id: 'NSI_PROCESSES', label: 'Processus & OS' },
          { id: 'NSI_NETWORK_PROTO', label: 'Protocoles réseau (TCP/IP)' },
          { id: 'NSI_ROUTING', label: 'Routage & IHM Web' },
          { id: 'NSI_SECURITY', label: 'Sécurité informatique' },
        ],
      },
      {
        rawTitle: 'Langages et programmation',
        normalizedTitle: 'POO & Projets',
        domainId: 'python_advanced',
        skills: [
          { id: 'NSI_PY_FUNCTIONS', label: 'Fonctions & Spécifications' },
          { id: 'NSI_PY_TESTS', label: 'Tests & Assertions' },
          { id: 'NSI_PY_MODULES', label: 'Modules & Bibliothèques' },
          { id: 'NSI_PY_RECURSION', label: 'Récursivité (Intro)' },
          { id: 'NSI_POO', label: 'Programmation Orientée Objet' },
        ],
      },
    ],
  },
};

function generateCandidates(key: ProgrammeKey): ProgrammeCandidates {
  const programme = PROGRAMMES[key];
  return {
    programmeKey: key,
    generatedAt: new Date().toISOString(),
    schemaVersion: 'v1.3',
    sections: programme.sections.map((section) => ({
      rawTitle: section.rawTitle,
      normalizedTitle: section.normalizedTitle,
      domainId: section.domainId,
      candidates: section.skills.map((skill): SkillCandidate => ({
        rawLabel: skill.label,
        normalizedLabel: skill.label,
        confidence: 1.0, // Curated data = high confidence
        anchors: [{ excerpt: `Programme officiel — ${section.rawTitle} — ${skill.label}` }],
      })),
    })),
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const outDir = path.resolve(__dirname, '../../programmes/generated');
fs.mkdirSync(outDir, { recursive: true });

const keys: ProgrammeKey[] = ['maths_premiere', 'maths_terminale', 'nsi_premiere', 'nsi_terminale'];

for (const key of keys) {
  const candidates = generateCandidates(key);
  const outPath = path.join(outDir, `${key}.skills.generated.json`);
  fs.writeFileSync(outPath, JSON.stringify(candidates, null, 2), 'utf-8');
  console.log(`✅ Generated: ${outPath} (${candidates.sections.reduce((a, s) => a + s.candidates.length, 0)} skills)`);
}

console.log('\n🎯 All 4 generated JSON files written to programmes/generated/');
