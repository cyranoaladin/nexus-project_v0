"use client";

import { Radar, RadarChart as RC, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

export default function RadarChart({ data }: { data: { domain: string; percent: number }[] }) {
  const chartData = data.map((d) => ({ subject: d.domain, A: d.percent }));
  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <RC cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar name="Maîtrise" dataKey="A" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
        </RC>
      </ResponsiveContainer>
    </div>
  );
}
