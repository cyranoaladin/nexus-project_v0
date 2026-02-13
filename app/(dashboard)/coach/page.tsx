
"use client";

import { useSession } from "next-auth/react";
import CoachAvailability from "@/components/ui/coach-availability";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileText } from "lucide-react";

export default function CoachDashboard() {
    const { data: session } = useSession();

    return (
        <div className="min-h-screen bg-surface-darker text-neutral-100 dashboard-soft">
            <div className="container mx-auto py-8 space-y-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-neutral-200">
                        Dashboard Coach
                    </div>
                    <h1 className="mt-3 text-3xl font-bold text-white">Bonjour, Coach {session?.user?.firstName}</h1>
                    <p className="text-neutral-300">Gérez vos sessions et vos disponibilités.</p>
                </div>
            </div>

            <Tabs defaultValue="availability" className="space-y-4">
                <TabsList className="bg-white/5 border border-white/10">
                    <TabsTrigger value="availability" className="text-neutral-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">Mes Disponibilités</TabsTrigger>
                    <TabsTrigger value="sessions" className="text-neutral-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">Mes Sessions</TabsTrigger>
                </TabsList>

                <TabsContent value="availability">
                    <Card className="bg-surface-card border border-white/10 shadow-premium">
                        <CardHeader>
                            <CardTitle className="text-white">Gestion du Planning</CardTitle>
                            <CardDescription className="text-slate-700">Définissez vos créneaux de disponibilité pour les élèves.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Assuming CoachAvailability handles logic internally or takes props */}
                            {session?.user?.id ? (
                                <CoachAvailability coachId={session.user.id} />
                            ) : (
                                <p className="text-slate-700">Chargement du profil...</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sessions">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="bg-surface-card border border-white/10 shadow-premium">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <Clock className="w-4 h-4 text-brand-accent" /> Prochaines Sessions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-700">Liste des sessions à venir (Placeholder)</p>
                                {/* Implementation of session list would go here */}
                            </CardContent>
                        </Card>
                        <Card className="bg-surface-card border border-white/10 shadow-premium">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <FileText className="w-4 h-4 text-brand-accent" /> Rapports à Remplir
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-700">Sessions terminées en attente de rapport (Placeholder)</p>
                                {/* Implementation of pending reports list would go here */}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
            </div>
        </div>
    );
}
