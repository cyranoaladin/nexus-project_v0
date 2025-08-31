'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, User, BookOpen } from 'lucide-react';

interface CoachInfo {
  firstName?: string;
  lastName?: string;
  pseudonym?: string;
  tag?: string;
}

interface SessionItem {
  id: string;
  title: string;
  subject: string;
  status: string;
  scheduledAt: string;
  duration: number;
  creditCost: number;
  location?: string | null;
  coach: CoachInfo;
}

export default function EleveMesSessionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push('/auth/signin');
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/student/sessions', { cache: 'no-store' });
        if (!res.ok) throw new Error('Impossible de récupérer vos sessions');
        const data = await res.json();
        setSessions(data);
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
          <p className="text-gray-600">Chargement de vos sessions…</p>
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
          <p className="text-gray-600 text-sm">Réessayez plus tard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mes Sessions</h1>
          <p className="text-gray-600 text-sm">Historique et prochaines sessions</p>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Aucune session</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Vous n'avez pas encore de session planifiée.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Card key={s.id} className="border border-gray-200">
                <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <div className="font-semibold text-gray-900">{s.title || s.subject}</div>
                      <div className="text-xs text-gray-600">
                        {new Date(s.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        {s.duration ? ` • ${s.duration} min` : ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5" /> {s.subject}
                        <span className="text-gray-300">•</span>
                        <User className="w-3.5 h-3.5" /> {s.coach.pseudonym || `${s.coach.firstName ?? ''} ${s.coach.lastName ?? ''}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === 'COMPLETED' ? 'default' : s.status === 'CANCELLED' ? 'destructive' : 'outline'}>
                      {s.status}
                    </Badge>
                    <Badge variant="outline">{s.creditCost} crédits</Badge>
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
