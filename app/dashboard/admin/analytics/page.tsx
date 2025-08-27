'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Activity, Users as UsersIcon, CreditCard, Database } from 'lucide-react';

interface AnalyticsData {
  period: string;
  summary: {
    totalRevenue: number;
    totalUsers: number;
    totalSessions: number;
    totalSubscriptions: number;
  };
  revenueData: Array<{ date: string; amount: number; count: number }>;
  userGrowthData: Array<{ date: string; role: string; count: number }>;
  sessionData: Array<{ date: string; status: string; count: number }>;
  subscriptionData: Array<{ date: string; status: string; count: number }>;
  creditData: Array<{ date: string; type: string; amount: number; count: number }>;
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

export default function AdminAnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('period', period);
    return params.toString();
  }, [period]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin');
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/admin/analytics?${query}`, { cache: 'no-store' });
        if (!res.ok) throw new Error("Erreur de récupération des analytics");
        setData(await res.json());
      } catch (e: any) {
        setError(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [status, session, router, query]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 text-red-600">⚠️</div>
          <p className="text-red-600 mb-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-gray-600 text-sm">Aperçu des métriques clés</p>
          </div>
          <div className="w-40">
            <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="year">Année</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenus</CardTitle>
              <CreditCard className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">{data?.summary.totalRevenue?.toLocaleString() || 0} TND</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <UsersIcon className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700">{data?.summary.totalUsers || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sessions</CardTitle>
              <Database className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-700">{data?.summary.totalSessions || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abonnements</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">{data?.summary.totalSubscriptions || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" /> Activités récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentActivities?.length ? (
              <div className="space-y-2">
                {data.recentActivities.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start justify-between border-b last:border-b-0 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{a.title}</div>
                      <div className="text-xs text-gray-600">{a.description}</div>
                    </div>
                    <div className="text-xs text-gray-500">{new Date(a.time).toLocaleDateString('fr-FR')}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600">Aucune activité.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
