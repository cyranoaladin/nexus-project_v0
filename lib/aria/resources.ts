/**
 * ARIA Resource Mapping Engine.
 *
 * Source de vérité UNIQUE pour les ressources pédagogiques attachées aux cours ARIA.
 *
 * Invariants stricts :
 * - ARIA_RESOURCE_MAPPING_ENGINE=1 : Seul moteur d'association des ressources.
 * - Tout document porte un courseKey univoque.
 * - Zéro contamination inter-niveaux :
 *     Maths Première != Maths Terminale
 *     EDS Générale != STMG
 *     NSI Première != NSI Terminale
 * - Les ressources officielles sont vérifiées sur disque.
 */

import path from 'path';
import fs from 'fs';
import type { AriaResource, AriaCourseKey } from './contracts';

// ─── Catalogue canonique des ressources ──────────────────────────────────────

const STATIC_RESOURCES: readonly AriaResource[] = [
  // ── eds-maths-premiere ──
  {
    id: 'res-maths-1ere-prog-bo',
    courseKey: 'eds-maths-premiere',
    title: 'Programme officiel — Spécialité Mathématiques Première',
    description: "Bulletin Officiel spécial n° 1 du 22 janvier 2019 / arrêté d'ajustement du 2 avril 2026.",
    type: 'PDF',
    provenance: 'OFFICIEL_MEN',
    sourceLabel: "Ministère de l'Éducation Nationale",
    filename: 'programmes/programme_eds_maths_premiere.pdf',
    sizeBytes: 485122,
  },
  {
    id: 'res-maths-1ere-automatismes-bo',
    courseKey: 'eds-maths-premiere',
    title: 'Automatismes EAM — Annexe officielle (Session 2027)',
    description: 'Attendus officiels et types de questions pour la partie automatismes sans calculatrice.',
    type: 'PDF',
    provenance: 'OFFICIEL_MEN',
    sourceLabel: 'Bulletin Officiel',
    filename: 'programmes/automatismes-eds-premiere/bo-annexe-automatismes-eam-2025-2026-session-2027.pdf',
    sizeBytes: 150247,
  },
  {
    id: 'res-maths-1ere-automatismes-sim',
    courseKey: 'eds-maths-premiere',
    title: "Entraînement Automatismes Première",
    description: "Batterie d'automatismes calculatoires et algébriques pour la Première.",
    type: 'EXERCICE',
    provenance: 'NEXUS_METHODE',
    sourceLabel: 'Nexus Réussite',
  },

  // ── eds-maths-terminale ──
  {
    id: 'res-maths-tle-prog-bo',
    courseKey: 'eds-maths-terminale',
    title: 'Programme officiel — Spécialité Mathématiques Terminale',
    description: 'Bulletin Officiel spécial n° 8 du 25 juillet 2019 — Spécialité Terminale.',
    type: 'PDF',
    provenance: 'OFFICIEL_MEN',
    sourceLabel: "Ministère de l'Éducation Nationale",
    filename: 'programmes/programme_eds_maths_terminale.pdf',
    sizeBytes: 487234,
  },
  {
    id: 'res-maths-tle-annales-bac',
    courseKey: 'eds-maths-terminale',
    title: 'Annales zéro et sujets types — Épreuve Terminale',
    description: 'Sujets corrigés et grilles de notation officielles de la spécialité Mathématiques.',
    type: 'ANNALE_BAC',
    provenance: 'OFFICIEL_MEN',
    sourceLabel: 'Éduscol',
  },

  // ── eds-nsi-premiere ──
  {
    id: 'res-nsi-1ere-prog-bo',
    courseKey: 'eds-nsi-premiere',
    title: 'Programme officiel — Spécialité NSI Première',
    description: 'Bulletin Officiel spécial n° 1 du 22 janvier 2019 — Numérique et Sciences Informatiques.',
    type: 'PDF',
    provenance: 'OFFICIEL_MEN',
    sourceLabel: "Ministère de l'Éducation Nationale",
    filename: 'programmes/programme_eds_nsi_premiere.pdf',
    sizeBytes: 308154,
  },

  // ── eds-nsi-terminale ──
  {
    id: 'res-nsi-tle-prog-bo',
    courseKey: 'eds-nsi-terminale',
    title: 'Programme officiel — Spécialité NSI Terminale',
    description: 'Bulletin Officiel spécial n° 8 du 25 juillet 2019 — Spécialité NSI Terminale.',
    type: 'PDF',
    provenance: 'OFFICIEL_MEN',
    sourceLabel: "Ministère de l'Éducation Nationale",
    filename: 'programmes/programme_eds_nsi_terminale.pdf',
    sizeBytes: 191310,
  },
  {
    id: 'res-nsi-tle-pratique-guide',
    courseKey: 'eds-nsi-terminale',
    title: "Guide de l'Épreuve Pratique NSI (BAC)",
    description: "Modalités d'évaluation sur machine, banque d'exercices et barème officiel.",
    type: 'METHODE',
    provenance: 'NEXUS_METHODE',
    sourceLabel: 'Nexus Réussite',
  },

  // ── stmg-maths-premiere ──
  {
    id: 'res-stmg-maths-1ere-prog',
    courseKey: 'stmg-maths-premiere',
    title: 'Programme de Mathématiques — Voie Technologique STMG Première',
    description: 'Programme officiel du tronc commun de mathématiques en série STMG.',
    type: 'PDF',
    provenance: 'OFFICIEL_MEN',
    sourceLabel: "Ministère de l'Éducation Nationale",
  },

  // ── stmg-droit-eco-premiere ──
  {
    id: 'res-stmg-droit-eco-1ere-cadre',
    courseKey: 'stmg-droit-eco-premiere',
    title: 'Cadre méthodologique — Droit & Économie STMG Première',
    description: 'Méthode de qualification juridique et analyse documentaire économique.',
    type: 'METHODE',
    provenance: 'NEXUS_METHODE',
    sourceLabel: 'Nexus Réussite',
  },

  // ── stmg-sgn-premiere ──
  {
    id: 'res-stmg-sgn-1ere-cadre',
    courseKey: 'stmg-sgn-premiere',
    title: 'Sciences de Gestion et Numérique — Référentiel de compétences',
    description: 'Organisation, processus et transformation numérique en STMG.',
    type: 'SYNTHESE',
    provenance: 'NEXUS_METHODE',
    sourceLabel: 'Nexus Réussite',
  },

  // ── stmg-management-premiere ──
  {
    id: 'res-stmg-management-1ere-cadre',
    courseKey: 'stmg-management-premiere',
    title: 'Management — Notions fondamentales STMG Première',
    description: 'Finalités, parties prenantes et décisions stratégiques.',
    type: 'SYNTHESE',
    provenance: 'NEXUS_METHODE',
    sourceLabel: 'Nexus Réussite',
  },
];

const RESOURCES_BY_ID = new Map<string, AriaResource>(
  STATIC_RESOURCES.map((r) => [r.id, r]),
);

const RESOURCES_BY_COURSE = new Map<string, AriaResource[]>();
for (const r of STATIC_RESOURCES) {
  const list = RESOURCES_BY_COURSE.get(r.courseKey) ?? [];
  list.push(r);
  RESOURCES_BY_COURSE.set(r.courseKey, list);
}

/**
 * Retourne toutes les ressources associées STRICTEMENT à un cours.
 */
export function listResourcesForCourse(courseKey: AriaCourseKey): readonly AriaResource[] {
  return RESOURCES_BY_COURSE.get(courseKey) ?? [];
}

/**
 * Retourne une ressource par son identifiant unique.
 */
export function getResource(resourceId: string): AriaResource | null {
  return RESOURCES_BY_ID.get(resourceId) ?? null;
}

/**
 * Retourne toutes les ressources pour une liste de cours d'un élève.
 * Ne mélange jamais les cours d'un autre niveau ou d'une autre filière.
 */
export function listResourcesForStudentCourses(courseKeys: readonly AriaCourseKey[]): readonly AriaResource[] {
  const result: AriaResource[] = [];
  for (const key of courseKeys) {
    const list = RESOURCES_BY_COURSE.get(key);
    if (list) {
      result.push(...list);
    }
  }
  return result;
}

/**
 * Vérifie si le fichier associé à une ressource existe réellement sur disque.
 */
export function verifyResourceOnDisk(resourceId: string, rootDir: string = process.cwd()): boolean {
  const res = getResource(resourceId);
  if (!res || !res.filename) return false;
  const fullPath = path.resolve(rootDir, res.filename);
  return fs.existsSync(fullPath);
}

/**
 * Résout le chemin absolu sécurisé vers le fichier d'une ressource sur disque.
 * Empêche tout directory traversal.
 */
export function resolveResourceFilePath(resourceId: string, rootDir: string = process.cwd()): string | null {
  const res = getResource(resourceId);
  if (!res || !res.filename) return null;

  const resolvedRoot = path.resolve(rootDir);
  const fullPath = path.resolve(resolvedRoot, res.filename);

  if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
    return null; // Détection de path traversal
  }

  return fs.existsSync(fullPath) ? fullPath : null;
}
