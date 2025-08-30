// components/bilan/RadarScores.tsx
"use client";
import React from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';

export function RadarScores({ data }: { data: Array<{ domain: string; percent: number }> }) {
  const chartData = (data || []).map(d => ({ subject: d.domain, A: Math.max(0, Math.min(100, d.percent)) }));
  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <RadarChart data={chartData} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar name="Profil" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

