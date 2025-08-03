"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, CreditCard, Loader2, LogOut, Mail, Phone, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardAssistante() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [assistanteData, setAssistanteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    // Simulation de chargement des données assistante
    setTimeout(() => {
      setAssistanteData({
        pendingBilans: 3,
        pendingPayments: 2,
        todayTasks: [
          {
            id: "1",
            type: "bilan",
            title: "Nouveau bilan gratuit - Emma Martin",
            priority: "high",
            time: "Il y a 2h"
          },
          {
            id: "2",
            type: "payment",
            title: "Paiement Wise à valider - 450 TND",
            priority: "medium",
            time: "Il y a 4h"
          },
          {
            id: "3",
            type: "support",
            title: "Question parent - Problème connexion",
            priority: "low",
            time: "Il y a 6h"
          }
        ],
        stats: {
          totalStudents: 45,
          activeSubscriptions: 38,
          monthlyRevenue: 17250
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
          <p className="text-gray-600">Chargement de votre espace...</p>
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
                <Phone className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    Cléa - Assistante Pédagogique
                  </h1>
                  <p className="text-sm text-gray-500">Centre de Coordination</p>
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
            Bonjour Cléa ! 📞
          </h2>
          <p className="text-gray-600">
            Votre tableau de bord pour coordonner l'activité de Nexus Réussite.
          </p>
        </div>

        {/* Alertes et Tâches Urgentes */}
        {assistanteData?.pendingBilans > 0 || assistanteData?.pendingPayments > 0 ? (
          <div className="mb-8">
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center text-orange-800">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  Tâches Urgentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assistanteData.pendingBilans > 0 && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Nouveaux bilans gratuits</p>
                        <p className="text-sm text-gray-600">À traiter sous 24h</p>
                      </div>
                      <Badge variant="destructive">
                        {assistanteData.pendingBilans}
                      </Badge>
                    </div>
                  )}
                  {assistanteData.pendingPayments > 0 && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Paiements à valider</p>
                        <p className="text-sm text-gray-600">Virements Wise</p>
                      </div>
                      <Badge variant="destructive">
                        {assistanteData.pendingPayments}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Élèves Actifs</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {assistanteData?.stats?.totalStudents || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {assistanteData?.stats?.activeSubscriptions || 0} abonnements actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Chiffre d'Affaires</CardTitle>
              <CreditCard className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {assistanteData?.stats?.monthlyRevenue?.toLocaleString() || 0} TND
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Ce mois-ci
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tâches du Jour</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {assistanteData?.todayTasks?.length || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                À traiter aujourd'hui
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Tâches du Jour */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                Tâches d'Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assistanteData?.todayTasks?.length > 0 ? (
                <div className="space-y-4">
                  {assistanteData.todayTasks.map((task: any) => (
                    <div
                      key={task.id}
                      className={`p-4 rounded-lg border-l-4 ${task.priority === 'high'
                          ? 'bg-red-50 border-l-red-500'
                          : task.priority === 'medium'
                            ? 'bg-yellow-50 border-l-yellow-500'
                            : 'bg-blue-50 border-l-blue-500'
                        }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-1">{task.title}</h4>
                          <p className="text-sm text-gray-600">{task.time}</p>
                        </div>
                        <Badge
                          variant={task.priority === 'high' ? 'destructive' : 'outline'}
                          className="ml-2"
                        >
                          {task.priority === 'high' ? 'Urgent' : task.priority === 'medium' ? 'Moyen' : 'Faible'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucune tâche urgente
                  </h3>
                  <p className="text-gray-500">
                    Tout est sous contrôle aujourd'hui !
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outils de Gestion */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-green-600" />
                Outils de Gestion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium">Gestion des Utilisateurs</p>
                      <p className="text-sm text-gray-500">Créer, modifier, désactiver</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <Link href="/dashboard/assistante/paiements" className="font-medium">
                        Validation Paiements
                      </Link>
                      <p className="text-sm text-gray-500">Virements Wise manuels</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-purple-600" />
                    <div className="text-left">
                      <p className="font-medium">Support Client</p>
                      <p className="text-sm text-gray-500">Messages et demandes</p>
                    </div>
                  </div>
                </Button>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note :</strong> Les outils de gestion avancés seront disponibles
                  dans les prochaines phases de développement.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
