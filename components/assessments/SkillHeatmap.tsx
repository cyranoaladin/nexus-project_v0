/**
 * SkillHeatmap — CSS Grid heatmap for granular skill scores.
 *
 * Displays a color-coded grid of individual skill scores,
 * grouped by domain when possible.
 */

'use client';

interface SkillData {
  skillTag: string;
  score: number;
}

interface SkillHeatmapProps {
  /** Array of skill scores */
  data: SkillData[];
  /** Component title */
  title?: string;
}

/** Map skill tags to French labels */
const SKILL_LABELS: Record<string, string> = {
  limite_polynome: 'Limites polynômes',
  derivee_composee: 'Dérivée composée',
  integrale_calcul: 'Calcul intégral',
  suite_arithmetique: 'Suite arithmétique',
  suite_geometrique: 'Suite géométrique',
  equation_differentielle: 'Éq. différentielle',
  probabilite_conditionnelle: 'Proba conditionnelle',
  loi_binomiale: 'Loi binomiale',
  loi_normale: 'Loi normale',
  module_complexe: 'Module complexe',
  argument_complexe: 'Argument complexe',
  geometrie_espace: 'Géométrie espace',
  produit_scalaire: 'Produit scalaire',
  denombrement: 'Dénombrement',
  algorithme_tri: 'Algorithme tri',
  recursivite: 'Récursivité',
  sql_requete: 'Requête SQL',
  structure_donnees: 'Structure données',
  reseau_protocole: 'Protocole réseau',
};

function getSkillLabel(tag: string): string {
  return SKILL_LABELS[tag] || tag.replace(/_/g, ' ');
}

/** Get color class based on score */
function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/80 text-emerald-50';
  if (score >= 60) return 'bg-blue-500/70 text-blue-50';
  if (score >= 40) return 'bg-blue-400/60 text-blue-50';
  if (score >= 20) return 'bg-slate-500/70 text-slate-50';
  return 'bg-slate-700/80 text-slate-50';
}

export default function SkillHeatmap({ data, title = 'Carte des compétences' }: SkillHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-slate-500">Données de compétences non disponibles.</p>
      </div>
    );
  }

  // Sort by score ascending (weakest first)
  const sorted = [...data].sort((a, b) => a.score - b.score);

  return (
    <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-4 text-xs text-slate-300">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-700/80" />
          <span>0-19</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-slate-500/70" />
          <span>20-39</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-400/60" />
          <span>40-59</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500/70" />
          <span>60-79</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500/80" />
          <span>80-100</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {sorted.map((skill) => (
          <div
            key={skill.skillTag}
            className={`p-3 rounded-lg text-center transition-all hover:scale-105 ${getScoreColor(skill.score)}`}
          >
            <div className="text-xs font-medium truncate" title={getSkillLabel(skill.skillTag)}>
              {getSkillLabel(skill.skillTag)}
            </div>
            <div className="text-lg font-bold mt-1">{Math.round(skill.score)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
