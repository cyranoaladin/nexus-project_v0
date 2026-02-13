"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, BarChart3, CreditCard, Loader2, LogOut, TrendingUp, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface AnalyticsData {
  period: string;
  summary: {
    totalRevenue: number;
    totalUsers: number;
    totalSessions: number;
    totalSubscriptions: number;
  };
  revenueData: Array<{
    date: string;
    amount: number;
    count: number;
  }>;
  userGrowthData: Array<{
    date: string;
    role: string;
    count: number;
  }>;
  sessionData: Array<{
    date: string;
    status: string;
    count: number;
  }>;
  subscriptionData: Array<{
    date: string;
    status: string;
    count: number;
  }>;
  creditData: Array<{
    date: string;
    type: string;
    amount: number;
    count: number;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    time: string;
    status: string;
    studentName: string;
    coachName: string;
    subject: string;
    action: string;
  }>;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("month");
  const type = "all";

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        period,
        type
      });
      
      const response = await fetch(`/api/admin/analytics?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      
      const data = await response.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [period, type]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push("/auth/signin");
      return;
    }

    fetchAnalytics();
  }, [session, status, router, fetchAnalytics]);

  const getPeriodText = (period: string) => {
    switch (period) {
      case 'month': return 'Ce mois';
      case 'quarter': return 'Ce trimestre';
      case 'year': return 'Cette année';
      default: return 'Ce mois';
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button 
            onClick={() => fetchAnalytics()} 
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white">
                    Analytics & Rapports
                  </h1>
                  <p className="text-sm text-neutral-400">Analyses détaillées du système</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/admin">
                <Button variant="ghost" className="text-neutral-300 hover:text-white">
                  Retour au Dashboard
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-neutral-300 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Analytics & Rapports
              </h2>
              <p className="text-neutral-400">
                Analyses détaillées des performances et activités
              </p>
            </div>
            <div className="flex space-x-4">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-32 border-white/10 bg-surface-elevated text-neutral-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Revenus</CardTitle>
              <CreditCard className="h-4 w-4 text-emerald-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-300">
                {analyticsData?.summary.totalRevenue?.toLocaleString() || 0} TND
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {getPeriodText(period)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Nouveaux Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-brand-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-brand-accent">
                {analyticsData?.summary.totalUsers || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {getPeriodText(period)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Sessions</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-200">
                {analyticsData?.summary.totalSessions || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {getPeriodText(period)}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Abonnements</CardTitle>
              <CreditCard className="h-4 w-4 text-amber-300" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-300">
                {analyticsData?.summary.totalSubscriptions || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {getPeriodText(period)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Revenue Analytics */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-emerald-300" />
                Revenus {getPeriodText(period)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.revenueData && analyticsData.revenueData.length > 0 ? (
                  analyticsData.revenueData.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div>
                        <p className="font-medium text-neutral-100">{new Date(item.date).toLocaleDateString('fr-FR')}</p>
                        <p className="text-sm text-neutral-400">{item.count} transactions</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-300">{item.amount.toLocaleString()} TND</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                    <p className="text-neutral-400">Aucune donnée de revenus</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Growth Analytics */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-brand-accent" />
                Croissance Utilisateurs {getPeriodText(period)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.userGrowthData && analyticsData.userGrowthData.length > 0 ? (
                  analyticsData.userGrowthData.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div>
                        <p className="font-medium text-neutral-100">{new Date(item.date).toLocaleDateString('fr-FR')}</p>
                        <p className="text-sm text-neutral-400">{item.role}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-accent">+{item.count}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                    <p className="text-neutral-400">Aucune donnée de croissance</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Session Analytics */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-purple-300" />
                Sessions {getPeriodText(period)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.sessionData && analyticsData.sessionData.length > 0 ? (
                  analyticsData.sessionData.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div>
                        <p className="font-medium text-neutral-100">{new Date(item.date).toLocaleDateString('fr-FR')}</p>
                        <Badge
                          variant={
                            item.status === 'COMPLETED'
                              ? 'default'
                              : item.status === 'FAILED'
                              ? 'destructive'
                              : item.status === 'IN_PROGRESS'
                              ? 'warning'
                              : 'outline'
                          }
                        >
                          {item.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-200">{item.count}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <TrendingUp className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                    <p className="text-neutral-400">Aucune donnée de sessions</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Credit Transactions */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-amber-300" />
                Transactions Crédits {getPeriodText(period)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData?.creditData && analyticsData.creditData.length > 0 ? (
                  analyticsData.creditData.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div>
                        <p className="font-medium text-neutral-100">{new Date(item.date).toLocaleDateString('fr-FR')}</p>
                        <p className="text-sm text-neutral-400">{item.type}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-300">{item.amount}</p>
                        <p className="text-xs text-neutral-400">{item.count} transactions</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                    <p className="text-neutral-400">Aucune donnée de crédits</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activities */}
        <Card className="mt-8 bg-surface-card border border-white/10 shadow-premium">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <BarChart3 className="w-5 h-5 mr-2 text-brand-accent" />
              Activités Récentes du Système
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analyticsData?.recentActivities && analyticsData.recentActivities.length > 0 ? (
                analyticsData.recentActivities.slice(0, 10).map((activity, index) => (
                  <div key={activity.id || index} className="flex items-start space-x-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                    <div className="flex-shrink-0">
                      {activity.type === 'session' && <TrendingUp className="w-5 h-5 text-brand-accent" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">
                        {activity.title}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {activity.description}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {activity.action} - {new Date(activity.time).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Badge
                      variant={
                        activity.status === 'COMPLETED'
                          ? 'default'
                          : activity.status === 'FAILED'
                          ? 'destructive'
                          : activity.status === 'IN_PROGRESS'
                          ? 'warning'
                          : 'outline'
                      }
                    >
                      {activity.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                  <p className="text-neutral-400">Aucune activité récente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 
