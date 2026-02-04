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
            <Card>
                <CardHeader><CardTitle>Évolution des Résultats</CardTitle></CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-brand-primary" />
                    Progression de {activeChildren[0].name}
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
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="rating"
                                name="Performance (1-5)"
                                stroke="#4F46E5"
                                strokeWidth={3}
                                activeDot={{ r: 8 }}
                                dot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
