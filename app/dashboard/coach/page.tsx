"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, CheckCircle, Clock, Loader2, LogOut, MessageCircle, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardCoach() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [coachData, setCoachData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'COACH') {
      router.push("/auth/signin");
      return;
    }

    // Simulation de chargement des données coach
    setTimeout(() => {
      setCoachData({
        pseudonym: "Axiom",
        specialties: ["Mathématiques", "Maths Expertes"],
        todaySessions: [
          {
            id: "1",
            studentName: "Emma M.",
            subject: "Mathématiques",
            time: "14:00",
            type: "En ligne",
            status: "scheduled"
          },
          {
            id: "2",
            studentName: "Lucas D.",
            subject: "Maths Expertes",
            time: "16:00",
            type: "Présentiel",
            status: "scheduled"
          }
        ],
        weekStats: {
          totalSessions: 12,
          completedSessions: 8,
          upcomingSessions: 4
        }
      });
      setLoading(false);
    }, 1000);
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de votre espace coach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    {coachData?.pseudonym || session?.user.firstName}
                  </h1>
                  <p className="text-sm text-gray-500">Espace Coach</p>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Bonjour {coachData?.pseudonym} ! 👨‍🏫
          </h2>
          <p className="text-gray-600">
            Voici votre tableau de bord pour gérer vos sessions et suivre vos élèves.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {coachData?.specialties?.map((specialty: string, index: number) => (
              <Badge key={index} variant="outline">
                {specialty}
              </Badge>
            ))}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions Cette Semaine</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {coachData?.weekStats?.totalSessions || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {coachData?.weekStats?.completedSessions || 0} terminées, {coachData?.weekStats?.upcomingSessions || 0} à venir
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aujourd'hui</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {coachData?.todaySessions?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Sessions programmées
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mes Élèves</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">8</div>
              <p className="text-xs text-gray-500 mt-1">
                Élèves suivis ce mois
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Planning du Jour */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Planning d'Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              {coachData?.todaySessions?.length > 0 ? (
                <div className="space-y-4">
                  {coachData.todaySessions.map((session: any) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{session.studentName}</h4>
                          <Badge variant="outline" className="text-xs">
                            {session.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{session.subject}</p>
                        <p className="text-sm font-medium text-blue-600">{session.time}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {session.status === 'scheduled' && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucune session aujourd'hui
                  </h3>
                  <p className="text-gray-500">
                    Profitez de cette journée pour préparer vos prochains cours.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mes Élèves */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-green-600" />
                Mes Élèves
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Élève 1 */}
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">Emma M.</h4>
                      <Badge variant="outline" className="text-xs">
                        Terminale
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">Mathématiques • Dernière session: 12/01</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-green-600 font-medium">Progression: 85%</span>
                      <span className="text-xs text-gray-500">4.5 crédits restants</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      Voir Profil
                    </Button>
                  </div>
                </div>

                {/* Élève 2 */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">Lucas D.</h4>
                      <Badge variant="outline" className="text-xs">
                        Première
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">Maths Expertes • Dernière session: 10/01</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-blue-600 font-medium">Progression: 72%</span>
                      <span className="text-xs text-gray-500">2 crédits restants</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      Voir Profil
                    </Button>
                  </div>
                </div>

                {/* Élève 3 */}
                <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">Sarah K.</h4>
                      <Badge variant="outline" className="text-xs">
                        Seconde
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">Mathématiques • Première session prévue</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-purple-600 font-medium">Nouveau élève</span>
                      <span className="text-xs text-gray-500">8 crédits disponibles</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      Planifier 1ère Session
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Rapides */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Actions Rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                <Calendar className="w-6 h-6 text-blue-600" />
                <span>Gérer mon Planning</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                <MessageCircle className="w-6 h-6 text-purple-600" />
                <span>Messages Élèves</span>
              </Button>
              <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                <BookOpen className="w-6 h-6 text-green-600" />
                <span>Rédiger un Rapport</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
