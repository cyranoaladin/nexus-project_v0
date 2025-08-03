'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity,
  BarChart3,
  CreditCard,
  Database,
  FileText,
  Globe,
  Loader2,
  LogOut,
  Mail,
  Settings,
  Shield,
  TestTube,
  Users
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push("/auth/signin");
      return;
    }

    // Simulation de chargement des données admin
    setTimeout(() => {
      setAdminData({
        stats: {
          totalUsers: 156,
          totalRevenue: 34500,
          activeSubscriptions: 89,
          systemHealth: 98
        },
        recentActivity: [
          {
            type: 'user_created',
            message: 'Nouvel utilisateur inscrit: Emma Martin',
            time: 'Il y a 2h'
          },
          {
            type: 'payment_received',
            message: 'Paiement reçu: 450 TND (Formule Hybride)',
            time: 'Il y a 3h'
          },
          {
            type: 'system_alert',
            message: 'Sauvegarde automatique effectuée',
            time: 'Il y a 6h'
          }
        ]
      });
      setLoading(false);
    }, 1000);
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de l'administration...</p>
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
                <Shield className="w-8 h-8 text-red-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    Administration Nexus Réussite
                  </h1>
                  <p className="text-sm text-gray-500">Contrôle Total du Système</p>
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
            Tableau de Bord Administrateur 🛡️
          </h2>
          <p className="text-gray-600">
            Vue d'ensemble complète et contrôle de la plateforme Nexus Réussite.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs Total</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {adminData?.stats?.totalUsers || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                +12% ce mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenus Mensuels</CardTitle>
              <CreditCard className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {adminData?.stats?.totalRevenue?.toLocaleString()} TND
              </div>
              <p className="text-xs text-gray-500 mt-1">
                +8% par rapport au mois dernier
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abonnements Actifs</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {adminData?.stats?.activeSubscriptions || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Taux de rétention: 94%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Santé du Système</CardTitle>
              <Database className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {adminData?.stats?.systemHealth || 0}%
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tous les services opérationnels
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Outils d'Administration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2 text-blue-600" />
                Outils d'Administration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="w-full justify-start h-auto p-4" asChild>
                  <Link href="/dashboard/admin/tests">
                    <div className="flex items-center space-x-3">
                      <TestTube className="w-5 h-5 text-red-600" />
                      <div className="text-left">
                        <p className="font-medium">Tests Système</p>
                        <p className="text-sm text-gray-500">Email, Paiements, APIs</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium">Gestion Utilisateurs</p>
                      <p className="text-sm text-gray-500">CRUD complet</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="w-5 h-5 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium">Analytics</p>
                      <p className="text-sm text-gray-500">Métriques détaillées</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <Database className="w-5 h-5 text-purple-600" />
                    <div className="text-left">
                      <p className="font-medium">Base de Données</p>
                      <p className="text-sm text-gray-500">Monitoring et maintenance</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <Globe className="w-5 h-5 text-indigo-600" />
                    <div className="text-left">
                      <p className="font-medium">CMS Contenu</p>
                      <p className="text-sm text-gray-500">Gestion site web</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-4">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-yellow-600" />
                    <div className="text-left">
                      <p className="font-medium">Rapports</p>
                      <p className="text-sm text-gray-500">Export et analyses</p>
                    </div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activité Récente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-green-600" />
                Activité Récente du Système
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminData?.recentActivity?.length > 0 ? (
                <div className="space-y-4">
                  {adminData.recentActivity.map((activity: any, index: number) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {activity.type === 'user_created' && <Users className="w-5 h-5 text-blue-600" />}
                        {activity.type === 'payment_received' && <CreditCard className="w-5 h-5 text-green-600" />}
                        {activity.type === 'system_alert' && <Database className="w-5 h-5 text-orange-600" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.message}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune activité récente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Status System */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2 text-red-600" />
              État du Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                <Database className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="font-semibold text-green-800">Base de Données</p>
                <Badge variant="default" className="bg-green-600">Opérationnelle</Badge>
              </div>

              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <Mail className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="font-semibold text-blue-800">Service Email</p>
                <Badge variant="default" className="bg-blue-600">Opérationnel</Badge>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                <CreditCard className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                <p className="font-semibold text-purple-800">Paiements</p>
                <Badge variant="default" className="bg-purple-600">Opérationnels</Badge>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <Globe className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="font-semibold text-orange-800">API Externa</p>
                <Badge variant="default" className="bg-orange-600">Opérationnelles</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
