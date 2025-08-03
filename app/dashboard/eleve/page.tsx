"use client";

import { BadgeWidget } from "@/components/ui/badge-widget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, CreditCard, Loader2, LogOut, MessageCircle, User, Video } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardEleve() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [studentData, setStudentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push("/auth/signin");
      return;
    }

    // Simulation de chargement des données élève
    setTimeout(() => {
      setStudentData({
        credits: 4.5,
        nextSession: null,
        recentActivity: []
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
                <User className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    {session?.user.firstName} {session?.user.lastName}
                  </h1>
                  <p className="text-sm text-gray-500">Espace Élève</p>
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
            Bonjour {session?.user.firstName} ! 👋
          </h2>
          <p className="text-gray-600">
            Bienvenue dans votre espace personnel Nexus Réussite.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Solde de Crédits */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solde de Crédits</CardTitle>
              <CreditCard className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {studentData?.credits || 0} crédits
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Disponibles pour vos sessions
              </p>
            </CardContent>
          </Card>

          {/* Prochaine Session */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prochaine Session</CardTitle>
              <Calendar className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                --
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Aucune session programmée
              </p>
            </CardContent>
          </Card>

          {/* Messages ARIA */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Messages ARIA</CardTitle>
              <MessageCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                0
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Questions posées aujourd'hui
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section avec Gamification et Actions Rapides */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Widget Gamification - Badges */}
          <div className="lg:col-span-1">
            <BadgeWidget
              studentId={session?.user.id || ""}
              className="h-fit"
            />
          </div>

          {/* Actions Rapides */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2" asChild>
                    <Link href="/dashboard/eleve/sessions">
                      <Calendar className="w-6 h-6 text-blue-600" />
                      <span className="text-sm font-medium">Réserver une Session</span>
                      <span className="text-xs text-gray-500">Planifiez un cours</span>
                    </Link>
                  </Button>

                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2" asChild>
                    <Link href="/dashboard/eleve/mes-sessions">
                      <Video className="w-6 h-6 text-green-600" />
                      <span className="text-sm font-medium">Mes Sessions</span>
                      <span className="text-xs text-gray-500">Rejoindre un cours</span>
                    </Link>
                  </Button>

                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2" asChild>
                    <Link href="/dashboard/eleve/ressources">
                      <BookOpen className="w-6 h-6 text-purple-600" />
                      <span className="text-sm font-medium">Mes Ressources</span>
                      <span className="text-xs text-gray-500">Fiches et exercices</span>
                    </Link>
                  </Button>

                  <Button variant="outline" className="h-auto p-4 flex flex-col items-center space-y-2">
                    <MessageCircle className="w-6 h-6 text-indigo-600" />
                    <span className="text-sm font-medium">Chat avec ARIA</span>
                    <span className="text-xs text-gray-500">Assistant IA</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
