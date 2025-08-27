'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus } from 'lucide-react';

interface CoachItem {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  pseudonym: string;
  tag?: string;
  description?: string;
  philosophy?: string;
  expertise?: string;
  subjects?: string;
  availableOnline: boolean;
  availableInPerson: boolean;
  todaySessions: number;
  createdAt: string;
}

export default function AssistantCoachesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [coaches, setCoaches] = useState<CoachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push('/auth/signin');
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/assistant/coaches', { cache: 'no-store' });
        if (!res.ok) throw new Error('Erreur lors du chargement des coachs');
        setCoaches(await res.json());
      } catch (e: any) {
        setError(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [status, session, router]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Coachs</h1>
            <p className="text-gray-600 text-sm">Liste et disponibilité</p>
          </div>
        </div>

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
                <UserPlus className="w-5 h-5 text-blue-600" /> Coachs ({coaches.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coaches.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-1 text-sm">
                    <div className="font-semibold text-gray-900">{c.pseudonym} {c.tag ? <span className="text-gray-500">({c.tag})</span> : null}</div>
                    <div className="text-gray-700">{c.firstName} {c.lastName} • {c.email}</div>
                    {c.expertise && <div className="text-gray-600">Expertise: {c.expertise}</div>}
                    <div className="text-gray-600">Aujourd'hui: {c.todaySessions} session(s)</div>
                    <div className="text-gray-500 text-xs">{new Date(c.createdAt).toLocaleDateString('fr-FR')}</div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
