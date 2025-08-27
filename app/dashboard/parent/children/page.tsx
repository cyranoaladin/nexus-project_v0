'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, CreditCard, Calendar } from 'lucide-react';

interface ChildItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade?: string;
  school?: string;
  creditBalance: number;
  upcomingSessions: number;
  createdAt: string;
}

export default function ParentChildrenPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'PARENT') {
      router.push('/auth/signin');
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/parent/children', { cache: 'no-store' });
        if (!res.ok) throw new Error('Impossible de récupérer les enfants');
        const data = await res.json();
        setChildren(data);
      } catch (e: any) {
        setError(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [status, session, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement…</p>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Gestion des Enfants</h1>
          <p className="text-gray-600 text-sm">Liste des enfants rattachés à votre compte</p>
        </div>

        {children.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucun enfant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Vous n'avez pas encore ajouté d'enfant.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600" />
                    {c.firstName} {c.lastName}
                    {c.grade && <Badge variant="outline">{c.grade}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 space-y-1">
                  <div>Email: <span className="text-gray-900">{c.email}</span></div>
                  {c.school && <div>Établissement: <span className="text-gray-900">{c.school}</span></div>}
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-green-600" />
                    Solde de crédits: <strong>{c.creditBalance}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    Prochaines sessions: <strong>{c.upcomingSessions}</strong>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
