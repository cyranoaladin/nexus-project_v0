'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Activity } from 'lucide-react';

interface ActivityItem {
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
}

export default function AdminActivitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | 'session' | 'user' | 'subscription' | 'credit'>('ALL');

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type && type !== 'ALL') params.set('type', type);
    params.set('limit', '50');
    return params.toString();
  }, [search, type]);

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
        const res = await fetch(`/api/admin/activities?${query}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Erreur de chargement des activités');
        const data = await res.json();
        setItems(data.activities);
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
            <h1 className="text-2xl font-bold text-gray-900">Activités du Système</h1>
            <p className="text-gray-600 text-sm">Historique des événements récents</p>
          </div>
        </div>

        <Card className="mb-4">
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input placeholder="Rechercher (titre, description, utilisateur)" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                <SelectItem value="session">Sessions</SelectItem>
                <SelectItem value="user">Utilisateurs</SelectItem>
                <SelectItem value="subscription">Abonnements</SelectItem>
                <SelectItem value="credit">Crédits</SelectItem>
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
                <Activity className="w-5 h-5 text-green-600" /> Activités ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.map((a) => (
                <div key={a.id} className="flex items-start justify-between border-b last:border-b-0 py-2">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{a.title}</div>
                    <div className="text-xs text-gray-600">{a.description}</div>
                    <div className="text-xs text-gray-400">{a.action}</div>
                  </div>
                  <div className="text-xs text-gray-500">{new Date(a.time).toLocaleDateString('fr-FR')}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
