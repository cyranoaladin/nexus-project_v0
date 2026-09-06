"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProgressData {
  date: string;
  ssn: number;
}

interface ProgressEvolutionChartProps {
  data: ProgressData[];
}

export function ProgressEvolutionChart({ data }: ProgressEvolutionChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-neutral-300">Aucune mesure de progression disponible pour le moment.</p>;
  }
  return (
    <Card className="bg-surface-card border-white/10 shadow-premium h-[400px]">
      <CardHeader>
        <CardTitle className="text-white text-base">Évolution de la Progression</CardTitle>
      </CardHeader>
      <CardContent className="relative h-[300px] w-full min-h-[300px]">
        <div className="absolute inset-0 pb-6 pr-6">
          <ResponsiveContainer minWidth={0} minHeight={0} width="100%" height="100%">
            <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#666" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(str) => new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            />
            <YAxis 
              stroke="#666" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false}
              domain={[0, 100]}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              itemStyle={{ fontSize: '12px' }}
              labelStyle={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}
            />
            <Legend verticalAlign="top" height={36}/>
            <Line
              type="monotone"
              dataKey="ssn"
              name="SSN enregistré"
              stroke="#6366f1"
              strokeWidth={3}
              dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
