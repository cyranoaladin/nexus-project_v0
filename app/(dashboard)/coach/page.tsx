
"use client";

import { useSession } from "next-auth/react";
import CoachAvailability from "@/components/ui/coach-availability";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, FileText } from "lucide-react";

export default function CoachDashboard() {
    const { data: session } = useSession();

    return (
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Bonjour, Coach {session?.user?.firstName}</h1>
                    <p className="text-gray-500">Gérez vos sessions et vos disponibilités.</p>
                </div>
            </div>

            <Tabs defaultValue="availability" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="availability">Mes Disponibilités</TabsTrigger>
                    <TabsTrigger value="sessions">Mes Sessions</TabsTrigger>
                </TabsList>

                <TabsContent value="availability">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestion du Planning</CardTitle>
                            <CardDescription>Définissez vos créneaux de disponibilité pour les élèves.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Assuming CoachAvailability handles logic internally or takes props */}
                            {session?.user?.id ? (
                                <CoachAvailability coachId={session.user.id} />
                            ) : (
                                <p>Chargement du profil...</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="sessions">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> Prochaines Sessions
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">Liste des sessions à venir (Placeholder)</p>
                                {/* Implementation of session list would go here */}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Rapports à Remplir
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">Sessions terminées en attente de rapport (Placeholder)</p>
                                {/* Implementation of pending reports list would go here */}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
