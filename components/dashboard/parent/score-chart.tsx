"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from "lucide-react";

interface ScoreData {
    date: string;
    subject: string;
    rating: number;
}

interface ChildWithScores {
    id: string;
    name: string;
    recentScores: ScoreData[];
}

export function ScoreChart({ childrenData }: { childrenData: ChildWithScores[] }) {

    // Prepare data for chart
    // We need to flatten data or create separate lines for each child if multiple children match subject
    // However, linking scores to generic time axis can be tricky if dates differ.
    // Simple approach: Show one chart per child if multiple, or one combined if simple.
    // Let's implement a chart that shows the evolution of the FIRST child for now, or use tabs/select in a real complex app.
    // For this V1, let's aggregate all scores into a format useful for visual debugging.
    // Actually, plotting evolution requires a time axis.

    // Let's Filter out children with no scores
    const activeChildren = childrenData.filter(c => c.recentScores.length > 0);

    if (activeChildren.length === 0) {
        return (
            <Card className="bg-surface-card border border-white/10">
                <CardHeader><CardTitle className="text-white">Évolution des Résultats</CardTitle></CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-neutral-400">
                    Pas assez de données pour afficher le graphique.
                </CardContent>
            </Card>
        );
    }

    // Use the first child's data for the demo if multiple, or map all points
    // Ideally we want to see evolution of rating (1-5) over time.
    const chartData = activeChildren[0].recentScores.map(s => ({
        date: new Date(s.date).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
        rating: s.rating,
        subject: s.subject
    }));

    return (
        <Card className="bg-surface-card border border-white/10">
            <CardHeader>
                <CardTitle className="flex items-center text-white">
                    <TrendingUp className="w-5 h-5 mr-2 text-brand-accent" />
                    Progression de <span className="ml-1 text-brand-accent">{activeChildren[0].name}</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                            <XAxis dataKey="date" tick={{ fill: '#9AA4B2' }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                            <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fill: '#9AA4B2' }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} />
                            <Tooltip
                                contentStyle={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(18, 24, 38, 0.96)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.6)' }}
                                labelStyle={{ fontWeight: 'bold', color: '#E2E8F0' }}
                            />
                            <Legend wrapperStyle={{ color: '#AAB3C2' }} />
                            <Line
                                type="monotone"
                                dataKey="rating"
                                name="Performance (1-5)"
                                stroke="rgb(var(--color-brand-accent))"
                                strokeWidth={3}
                                activeDot={{ r: 7, fill: 'rgb(var(--color-brand-accent))' }}
                                dot={{ r: 3, fill: 'rgb(var(--color-brand-accent))' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
