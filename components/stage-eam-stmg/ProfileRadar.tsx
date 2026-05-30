"use client";

import { useEffect, useState } from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import { DOMAINS } from "@/content/stage-eam-stmg/domains";
import type { DomainScore } from "@/content/stage-eam-stmg/types";

export function ProfileRadar({ scores }: { scores: DomainScore[] }) {
  const [mounted, setMounted] = useState(false);
  const data = DOMAINS.map((domain) => ({
    domain: domain.shortLabel,
    score: scores.find((entry) => entry.domainId === domain.id)?.score ?? 0,
  }));

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-72 w-full rounded-card-sm bg-surface-elevated" aria-label="Radar en cours de chargement" />;
  }

  return (
    <div className="h-72 w-full" role="img" aria-label="Radar des cinq domaines STMG sur 100">
      <ResponsiveContainer minWidth={0} minHeight={0} width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="rgb(var(--color-neutral-700))" />
          <PolarAngleAxis dataKey="domain" tick={{ fill: "rgb(var(--color-neutral-200))", fontSize: 12 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "rgb(var(--color-neutral-400))", fontSize: 10 }} />
          <Radar dataKey="score" name="Niveau" stroke="rgb(var(--color-brand-accent))" fill="rgb(var(--color-brand-accent))" fillOpacity={0.24} strokeWidth={2} />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--color-surface-card))",
              border: "1px solid rgb(var(--color-neutral-700))",
              color: "rgb(var(--color-neutral-100))",
            }}
            formatter={(value) => [`${value}/100`, "Niveau"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
