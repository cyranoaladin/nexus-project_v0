'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Check, X } from 'lucide-react';

interface CreditRequest {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  student: { id: string; firstName: string; lastName: string; grade?: string; school?: string };
  parent: { firstName?: string; lastName?: string; email?: string };
}

export default function AssistantCreditsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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
        const res = await fetch('/api/assistant/credit-requests', { cache: 'no-store' });
        if (!res.ok) throw new Error('Erreur de chargement des demandes');
        const data = await res.json();
        setRequests(data.creditRequests || []);
      } catch (e: any) {
        setError(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [status, session, router]);

  const act = async (requestId: string, action: 'approve' | 'reject') => {
    setSubmittingId(requestId);
    try {
      const res = await fetch('/api/assistant/credit-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      if (!res.ok) throw new Error('Action échouée');
      const refreshed = await fetch('/api/assistant/credit-requests', { cache: 'no-store' });
      setRequests((await refreshed.json()).creditRequests || []);
    } catch (e) {
      alert('Une erreur est survenue');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Crédits</h1>
            <p className="text-gray-600 text-sm">Valider ou rejeter les demandes de crédits</p>
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
                <CreditCard className="w-5 h-5 text-orange-600" /> Demandes ({requests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Élève</th>
                    <th className="py-2 pr-4">Parent</th>
                    <th className="py-2 pr-4">Montant</th>
                    <th className="py-2 pr-4">Motif</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{r.student.firstName} {r.student.lastName} {r.student.grade ? `(${r.student.grade})` : ''}</td>
                      <td className="py-2 pr-4">{r.parent.firstName} {r.parent.lastName} <span className="text-gray-500">({r.parent.email})</span></td>
                      <td className="py-2 pr-4 font-semibold">{r.amount}</td>
                      <td className="py-2 pr-4">{r.description}</td>
                      <td className="py-2 pr-4">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Button size="sm" disabled={submittingId === r.id} onClick={() => act(r.id, 'approve')}>
                            <Check className="w-4 h-4 mr-1" /> Approuver
                          </Button>
                          <Button size="sm" variant="outline" disabled={submittingId === r.id} onClick={() => act(r.id, 'reject')}>
                            <X className="w-4 h-4 mr-1" /> Rejeter
                          </Button>
                        </div>
                      </td>
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
