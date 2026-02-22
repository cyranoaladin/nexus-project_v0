"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, School } from "lucide-react";

interface ChildData {
    id: string;
    name: string;
    grade: string | null;
    school: string | null;
    credits: number;
    badges: Array<{
        id: string;
        name: string;
        icon: string | null;
        category: string;
        earnedAt: string;
    }>;
}

export function ChildrenList({ childrenData }: { childrenData: ChildData[] }) {
    if (!childrenData || childrenData.length === 0) {
        return (
            <Card className="bg-surface-card border border-white/10">
                <CardContent className="pt-6 text-center text-neutral-400">
                    Aucun enfant associé à ce compte.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {childrenData.map((child) => (
                <Card key={child.id} className="overflow-hidden border border-white/10 bg-surface-card shadow-premium hover:border-brand-accent/40 transition-colors">
                    <CardHeader className="bg-gradient-to-br from-white/5 via-white/10 to-transparent pb-8">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-16 w-16 border border-white/10 shadow-premium">
                                <AvatarFallback className="bg-brand-accent text-surface-dark text-xl font-bold">
                                    {child.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle className="text-white">{child.name}</CardTitle>
                                <CardDescription className="flex items-center mt-1 text-neutral-300">
                                    <School className="w-3 h-3 mr-1 text-brand-accent" />
                                    {child.grade || "Niveau non défini"}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="-mt-4">
                        <div className="bg-surface-elevated/60 rounded-lg p-4 border border-white/10 mb-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-neutral-400">Crédits restants</span>
                                <span className="font-bold text-brand-accent">{child.credits}</span>
                            </div>
                            {child.school && (
                                <div className="flex justify-between items-center text-sm mt-2">
                                    <span className="text-neutral-400">École</span>
                                    <span className="font-medium text-neutral-100">{child.school}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold flex items-center text-neutral-100">
                                <Trophy className="w-4 h-4 mr-2 text-blue-200" />
                                Badges obtenus
                            </h4>
                            <ScrollArea className="h-[120px] w-full rounded-md border border-white/10 p-2 bg-surface-darker/60">
                                {child.badges.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {child.badges.map((badge) => (
                                            <div key={badge.id} className="flex items-center bg-white/5 border border-white/10 px-2 py-1 rounded-full text-xs text-neutral-200" title={badge.category}>
                                                <span className="mr-1">{badge.icon || "🏅"}</span>
                                                {badge.name}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-neutral-400 text-center py-4">
                                        Pas encore de badges. Encouragez {child.name.split(' ')[0]} !
                                    </p>
                                )}
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
