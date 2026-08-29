/**
 * ARIA Skill Graph Adapter — server-only.
 *
 * Point d'accès UNIQUE aux compétences structurées des cours.
 *
 * Source : `lib/diagnostics/definitions/generated/*.domains.json`
 * Identifiants stables compilés : domainId, skillId.
 *
 * Unicité globale :
 * Toutes les compétences sont préfixées par la clé de cours (`${courseKey}:${skillId}`)
 * pour garantir l'absence totale de collision entre niveaux.
 */

import 'server-only';

import mathsPremiere from '@/lib/diagnostics/definitions/generated/maths-premiere-p2.domains.json';
import mathsTerminale from '@/lib/diagnostics/definitions/generated/maths-terminale-p2.domains.json';
import nsiPremiere from '@/lib/diagnostics/definitions/generated/nsi-premiere-p2.domains.json';
import nsiTerminale from '@/lib/diagnostics/definitions/generated/nsi-terminale-p2.domains.json';
import mathsPremiereStmg from '@/lib/diagnostics/definitions/generated/maths-premiere-stmg-p2.domains.json';
import sgnPremiereStmg from '@/lib/diagnostics/definitions/generated/sgn-premiere-stmg-p2.domains.json';
import managementPremiereStmg from '@/lib/diagnostics/definitions/generated/management-premiere-stmg-p2.domains.json';
import droitEcoPremiereStmg from '@/lib/diagnostics/definitions/generated/droit-eco-premiere-stmg-p2.domains.json';

export interface AriaCompetency {
  readonly id: string; // ${courseKey}:${skillId}
  readonly rawSkillId: string;
  readonly label: string;
  readonly chapterId?: string;
  readonly prerequisite?: boolean;
}

export interface AriaDomain {
  readonly id: string; // ${courseKey}:${domainId}
  readonly rawDomainId: string;
  readonly label: string;
  readonly competencies: readonly AriaCompetency[];
}

export interface AriaSkillGraph {
  readonly courseKey: string;
  readonly domains: readonly AriaDomain[];
  readonly totalCompetencies: number;
}

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

interface CompiledSkillGraphFile {
  id: string;
  label: string;
  domains: readonly CompiledDomain[];
}

const DOMAIN_REGISTRY: Readonly<Record<string, CompiledSkillGraphFile>> = Object.freeze({
  'eds-maths-premiere': mathsPremiere as unknown as CompiledSkillGraphFile,
  'eds-maths-terminale': mathsTerminale as unknown as CompiledSkillGraphFile,
  'eds-nsi-premiere': nsiPremiere as unknown as CompiledSkillGraphFile,
  'eds-nsi-terminale': nsiTerminale as unknown as CompiledSkillGraphFile,
  'stmg-maths-premiere': mathsPremiereStmg as unknown as CompiledSkillGraphFile,
  'stmg-sgn-premiere': sgnPremiereStmg as unknown as CompiledSkillGraphFile,
  'stmg-management-premiere': managementPremiereStmg as unknown as CompiledSkillGraphFile,
  'stmg-droit-eco-premiere': droitEcoPremiereStmg as unknown as CompiledSkillGraphFile,
});

/**
 * Charge le graphe de compétences complet d'un cours avec identifiants univoques.
 */
export function getSkillGraph(courseKey: string): AriaSkillGraph | null {
  const file = DOMAIN_REGISTRY[courseKey];
  if (!file || !Array.isArray(file.domains)) return null;

  let totalCompetencies = 0;
  const domains: AriaDomain[] = file.domains.map((d: CompiledDomain) => {
    const competencies: AriaCompetency[] = d.skills.map((s: CompiledSkill) => {
      totalCompetencies++;
      return {
        id: `${courseKey}:${s.skillId}`,
        rawSkillId: s.skillId,
        label: s.skillLabel,
        chapterId: s.chapterId,
        prerequisite: s.prerequisite,
      };
    });

    return {
      id: `${courseKey}:${d.domainId}`,
      rawDomainId: d.domainId,
      label: d.domainLabel,
      competencies,
    };
  });

  return {
    courseKey,
    domains,
    totalCompetencies,
  };
}
