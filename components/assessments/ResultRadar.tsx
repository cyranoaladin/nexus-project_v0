/**
 * ResultRadar — Recharts RadarChart for domain score visualization.
 *
 * Displays a radar/spider chart showing scores across assessment domains.
 */

'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface DomainData {
  domain: string;
  score: number;
  fullMark?: number;
}

interface ResultRadarProps {
  /** Array of domain scores */
  data: DomainData[];
  /** Chart title */
  title?: string;
}

/** Map domain keys to French labels */
const DOMAIN_LABELS: Record<string, string> = {
  analysis: 'Analyse',
  algebra: 'Algèbre',
  geometry: 'Géométrie',
  prob_stats: 'Probabilités',
  algorithmic: 'Algorithmique',
  complexes: 'Complexes',
  suites: 'Suites',
  logic_sets: 'Logique',
  data_structures: 'Structures',
  databases: 'Bases de données',
  networks: 'Réseaux',
  python_programming: 'Python',
  systems_architecture: 'Architecture',
  data_representation: 'Représentation',
  data_processing: 'Traitement',
  methodologie: 'Méthodologie',
  rigueur: 'Rigueur',
  comprehension: 'Compréhension',
  application: 'Application',
};

function getDomainLabel(domain: string): string {
  return DOMAIN_LABELS[domain.toLowerCase()] || domain;
}

export default function ResultRadar({ data, title = 'Profil par domaine' }: ResultRadarProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-slate-500">Données de domaine non disponibles.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    domain: getDomainLabel(d.domain),
    score: Math.round(d.score),
    fullMark: d.fullMark ?? 100,
  }));

  return (
    <div className="p-6 bg-slate-800/50 rounded-xl border border-slate-700">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={320}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="domain"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickCount={5}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '13px',
            }}
            formatter={(value: number | undefined) => [`${value ?? 0}/100`, 'Score']}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
