"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface CohortData {
  label: string;
  value: number;
  isStudent: boolean;
}

interface CohortComparisonProps {
  data: CohortData[];
  studentName: string;
}

export function CohortComparison({ data, studentName }: CohortComparisonProps) {
  return (
    <Card className="bg-surface-card border-white/10 shadow-premium h-[300px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-sm">Positionnement Cohorte Nexus</CardTitle>
      </CardHeader>
      <CardContent className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis 
              dataKey="label" 
              type="category" 
              stroke="#666" 
              fontSize={10} 
              width={100}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              itemStyle={{ fontSize: '12px' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isStudent ? '#6366f1' : '#334155'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-brand-accent" />
            <span className="text-[10px] text-neutral-400">{studentName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <span className="text-[10px] text-neutral-400">Moyenne Nexus</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
