'use client';

import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';

interface RadarDataPoint {
  subject: string;
  score: number;
  confidence: number;
}

interface CompetenceRadarProps {
  radarData: RadarDataPoint[];
}

export default function CompetenceRadar({ radarData }: CompetenceRadarProps) {
  if (!radarData || radarData.length === 0) return null;

  const chartData = radarData.map((d) => ({
    category: d.subject.length > 14 ? d.subject.slice(0, 12) + '…' : d.subject,
    fullName: d.subject,
    Précision: Math.round(d.score),
    Confiance: Math.round(d.confidence),
  }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 print:shadow-none print:border-slate-300">
      <h2 className="text-lg font-bold text-slate-900 mb-1">Radar de Compétences</h2>
      <p className="text-sm text-slate-500 mb-6">
        Vue d&apos;ensemble de ton profil par domaine. La <strong className="text-blue-600">précision</strong> mesure
        tes bonnes réponses, la <strong className="text-brand-secondary">confiance</strong> mesure ta couverture.
      </p>

      <div className="w-full h-[350px] sm:h-[400px] print:h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="category"
              tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickCount={5}
            />
            <Radar
              name="Précision"
              dataKey="Précision"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Radar
              name="Confiance"
              dataKey="Confiance"
              stroke="#6b86a3"
              fill="#6b86a3"
              fillOpacity={0.1}
              strokeWidth={2}
              strokeDasharray="4 4"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '12px',
                padding: '8px 12px',
              }}
              formatter={(value?: number, name?: string) => [`${value ?? 0}%`, name ?? '']}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Print-friendly fallback table */}
      <div className="hidden print:block mt-4">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-300">
              <th className="text-left py-1 font-semibold text-slate-700">Domaine</th>
              <th className="text-right py-1 font-semibold text-blue-700">Précision</th>
              <th className="text-right py-1 font-semibold text-slate-700">Confiance</th>
            </tr>
          </thead>
          <tbody>
            {radarData.map((d) => (
              <tr key={d.subject} className="border-b border-slate-100">
                <td className="py-1 text-slate-700">{d.subject}</td>
                <td className="py-1 text-right font-bold text-blue-700">{Math.round(d.score)}%</td>
                <td className="py-1 text-right font-bold text-slate-700">{Math.round(d.confidence)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
