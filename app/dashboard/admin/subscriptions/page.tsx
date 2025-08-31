'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard } from 'lucide-react';

interface SubscriptionItem {
  id: string;
  planName: string;
  monthlyPrice: number;
  status: string;
  startDate: string;
  endDate?: string | null;
  student: { firstName?: string; lastName?: string; email?: string };
  parent: { firstName?: string; lastName?: string; email?: string };
}

export default function AdminSubscriptionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'CANCELLED' | 'EXPIRED'>('ALL');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter);
    params.set('limit', '20');
    return params.toString();
  }, [search, statusFilter]);

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
        const res = await fetch(`/api/admin/subscriptions?${query}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Erreur lors du chargement des abonnements');
        const data = await res.json();
        setItems(data.subscriptions);
      } catch (e: any) {
        setError(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [status, session, router, query]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Abonnements</h1>
            <p className="text-gray-600 text-sm">Recherche et filtrage</p>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Rechercher (nom, email, plan)" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                <SelectItem value="EXPIRED">EXPIRED</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {status === 'loading' || loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="text-center text-red-600 py-8">{error}</div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-green-600" />
                Abonnements ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Élève</th>
                    <th className="py-2 pr-4">Parent</th>
                    <th className="py-2 pr-4">Plan</th>
                    <th className="py-2 pr-4">Statut</th>
                    <th className="py-2 pr-4">Début</th>
                    <th className="py-2 pr-4">Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{s.student.firstName} {s.student.lastName}</td>
                      <td className="py-2 pr-4">{s.parent.firstName} {s.parent.lastName}</td>
                      <td className="py-2 pr-4">{s.planName} ({s.monthlyPrice} TND)</td>
                      <td className="py-2 pr-4">{s.status}</td>
                      <td className="py-2 pr-4">{new Date(s.startDate).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-4">{s.endDate ? new Date(s.endDate).toLocaleDateString('fr-FR') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
