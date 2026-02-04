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
            <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                    Aucun enfant associé à ce compte.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {childrenData.map((child) => (
                <Card key={child.id} className="overflow-hidden border-2 hover:border-brand-primary/50 transition-colors">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-8">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
                                <AvatarFallback className="bg-brand-primary text-white text-xl">
                                    {child.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <CardTitle>{child.name}</CardTitle>
                                <CardDescription className="flex items-center mt-1">
                                    <School className="w-3 h-3 mr-1" />
                                    {child.grade || "Niveau non défini"}
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="-mt-4">
                        <div className="bg-white rounded-lg p-4 shadow-sm border mb-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Crédits restants</span>
                                <span className="font-bold text-brand-primary">{child.credits}</span>
                            </div>
                            {child.school && (
                                <div className="flex justify-between items-center text-sm mt-2">
                                    <span className="text-gray-500">École</span>
                                    <span className="font-medium">{child.school}</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold flex items-center">
                                <Trophy className="w-4 h-4 mr-2 text-yellow-500" />
                                Badges obtenus
                            </h4>
                            <ScrollArea className="h-[120px] w-full rounded-md border p-2 bg-gray-50">
                                {child.badges.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {child.badges.map((badge) => (
                                            <div key={badge.id} className="flex items-center bg-white border px-2 py-1 rounded-full text-xs shadow-sm" title={badge.category}>
                                                <span className="mr-1">{badge.icon || "🏅"}</span>
                                                {badge.name}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-gray-400 text-center py-4">
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
