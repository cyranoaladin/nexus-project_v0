/**
 * ARIA Skill Graph Adapter — server-only.
 *
 * Point d'entrée UNIQUE vers les graphes de compétences. Aucun composant React
 * ne doit importer ni parser les JSON de programme directement.
 *
 * ── Choix de la source ───────────────────────────────────────────────────────
 * Deux familles de fichiers coexistent dans le dépôt :
 *
 *  • `programmes/generated/*.skills.generated.json` — vue « candidats »
 *    dépourvue de tout identifiant (`candidates[]` n'a que des libellés).
 *    Inexploitable pour un graphe de compétences adressable.
 *
 *  • `lib/diagnostics/definitions/generated/*.domains.json` — artefact compilé
 *    depuis `programmes/mapping/*.skills.map.yml`, porteur des identifiants
 *    stables et écrits à la main : `domainId`, `skillId`, `chapterId`.
 *
 * C'est la seconde famille qui est utilisée ici : c'est la seule qui permette
 * des identifiants déterministes.
 *
 * ── Unicité des identifiants ─────────────────────────────────────────────────
 * Les `skillId` sont stables mais NON uniques entre programmes : `PY_FUNC` et
 * `ANA_EXP` existent à l'identique dans `maths_premiere` et `maths_terminale`.
 * Toutes les identités exposées par cet adaptateur sont donc préfixées par la
 * clé de cours (`<courseKey>:<skillId>`), ce qui les rend globalement uniques
 * et déterministes.
 */

import 'server-only';

import type {
  AriaCompetency,
  AriaCourseKey,
  AriaDomain,
  AriaSkillGraph,
  AriaSkillGraphSummary,
} from '@/lib/aria/contracts';
import { getAriaCourse } from './catalog';

import mathsPremiere from '@/lib/diagnostics/definitions/generated/maths-premiere-p2.domains.json';
import mathsTerminale from '@/lib/diagnostics/definitions/generated/maths-terminale-p2.domains.json';
import nsiPremiere from '@/lib/diagnostics/definitions/generated/nsi-premiere-p2.domains.json';
import nsiTerminale from '@/lib/diagnostics/definitions/generated/nsi-terminale-p2.domains.json';
import mathsPremiereStmg from '@/lib/diagnostics/definitions/generated/maths-premiere-stmg-p2.domains.json';
import sgnPremiereStmg from '@/lib/diagnostics/definitions/generated/sgn-premiere-stmg-p2.domains.json';
import managementPremiereStmg from '@/lib/diagnostics/definitions/generated/management-premiere-stmg-p2.domains.json';
import droitEcoPremiereStmg from '@/lib/diagnostics/definitions/generated/droit-eco-premiere-stmg-p2.domains.json';

/** Forme minimale réellement consommée de l'artefact compilé. */
interface CompiledSkill {
  skillId: string;
  skillLabel: string;
  chapterId?: string;
  prerequisite?: boolean;
}

interface CompiledDomain {
  domainId: string;
  domainLabel: string;
  skills: CompiledSkill[];
}

interface CompiledDefinition {
  id: string;
  label: string;
  schemaVersion: string;
  domains: CompiledDomain[];
}

/**
 * Table `definitionKey` → artefact compilé. Les imports sont statiques
 * (résolus à la compilation) : aucune lecture disque à l'exécution, donc
 * aucune surface d'attaque par chemin de fichier arbitraire.
 */
const COMPILED_BY_DEFINITION_KEY: Readonly<Record<string, CompiledDefinition>> = Object.freeze({
  'maths-premiere-p2': mathsPremiere as unknown as CompiledDefinition,
  'maths-terminale-p2': mathsTerminale as unknown as CompiledDefinition,
  'nsi-premiere-p2': nsiPremiere as unknown as CompiledDefinition,
  'nsi-terminale-p2': nsiTerminale as unknown as CompiledDefinition,
  'maths-premiere-stmg-p2': mathsPremiereStmg as unknown as CompiledDefinition,
  'sgn-premiere-stmg-p2': sgnPremiereStmg as unknown as CompiledDefinition,
  'management-premiere-stmg-p2': managementPremiereStmg as unknown as CompiledDefinition,
  'droit-eco-premiere-stmg-p2': droitEcoPremiereStmg as unknown as CompiledDefinition,
});

/** Cache mémoire : la construction est purement déterministe. */
const GRAPH_CACHE = new Map<AriaCourseKey, AriaSkillGraph>();

function buildGraph(courseKey: AriaCourseKey, definitionKey: string): AriaSkillGraph | null {
  const compiled = COMPILED_BY_DEFINITION_KEY[definitionKey];
  if (!compiled) return null;

  const domains: AriaDomain[] = [];
  const competencies: AriaCompetency[] = [];

  for (const domain of compiled.domains) {
    domains.push({
      id: `${courseKey}:${domain.domainId}`,
      domainId: domain.domainId,
      label: domain.domainLabel,
      competencyCount: domain.skills.length,
    });

    for (const skill of domain.skills) {
      competencies.push({
        id: `${courseKey}:${skill.skillId}`,
        skillId: skill.skillId,
        label: skill.skillLabel,
        domainId: domain.domainId,
        chapterId: skill.chapterId ?? null,
        prerequisite: skill.prerequisite === true,
      });
    }
  }

  return {
    courseKey,
    definitionKey,
    version: compiled.schemaVersion,
    domains,
    competencies,
  };
}

/**
 * Graphe de compétences d'un cours, ou `null` si le cours n'en a pas.
 *
 * Ne lève jamais : une clé inconnue est un `null`, pas une exception. Cela
 * évite qu'une clé fournie par un client puisse provoquer une 500.
 */
export function getSkillGraph(courseKey: string): AriaSkillGraph | null {
  const cached = GRAPH_CACHE.get(courseKey);
  if (cached) return cached;

  const course = getAriaCourse(courseKey);
  if (!course || !course.definitionKey) return null;

  const graph = buildGraph(course.key, course.definitionKey);
  if (graph) GRAPH_CACHE.set(course.key, graph);
  return graph;
}

/** Domaines d'un cours. Tableau vide si aucun graphe n'existe. */
export function getCourseDomains(courseKey: string): readonly AriaDomain[] {
  return getSkillGraph(courseKey)?.domains ?? [];
}

/** Compétences d'un cours. Tableau vide si aucun graphe n'existe. */
export function getCourseCompetencies(courseKey: string): readonly AriaCompetency[] {
  return getSkillGraph(courseKey)?.competencies ?? [];
}

/** Résumé non sensible, exposable par l'API curriculum (aucun chemin fichier). */
export function getSkillGraphSummary(courseKey: string): AriaSkillGraphSummary {
  const graph = getSkillGraph(courseKey);
  if (!graph) {
    return {
      courseKey,
      available: false,
      domainCount: 0,
      competencyCount: 0,
      version: null,
    };
  }
  return {
    courseKey: graph.courseKey,
    available: true,
    domainCount: graph.domains.length,
    competencyCount: graph.competencies.length,
    version: graph.version,
  };
}

/** Clés de définition réellement embarquées. Utilisé par les tests d'intégrité. */
export function listCompiledDefinitionKeys(): readonly string[] {
  return Object.keys(COMPILED_BY_DEFINITION_KEY);
}
