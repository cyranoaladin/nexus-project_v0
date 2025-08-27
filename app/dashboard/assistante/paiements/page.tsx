'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, Check, X } from 'lucide-react';

interface PendingPayment {
  id: string;
  method: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  createdAt: string;
  parent: { id: string; email: string; firstName?: string; lastName?: string };
  metadata: any;
}

export default function AssistantPaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
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
        const res = await fetch('/api/assistant/payments', { cache: 'no-store' });
        if (!res.ok) throw new Error('Erreur de chargement des paiements');
        const data = await res.json();
        setPayments(data.payments || []);
      } catch (e: any) {
        setError(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [status, session, router]);

  const act = async (paymentId: string, action: 'approve' | 'reject') => {
    setSubmittingId(paymentId);
    try {
      const res = await fetch('/api/payments/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action }),
      });
      if (!res.ok) throw new Error('Action échouée');
      // refresh list
      const refreshed = await fetch('/api/assistant/payments', { cache: 'no-store' });
      setPayments((await refreshed.json()).payments || []);
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
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Paiements</h1>
            <p className="text-gray-600 text-sm">Valider ou rejeter les paiements</p>
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
                <CreditCard className="w-5 h-5 text-green-600" /> Paiements en attente ({payments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Parent</th>
                    <th className="py-2 pr-4">Méthode</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Montant</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{p.parent.firstName} {p.parent.lastName} <span className="text-gray-500">({p.parent.email})</span></td>
                      <td className="py-2 pr-4 uppercase">{p.method}</td>
                      <td className="py-2 pr-4">{p.type}</td>
                      <td className="py-2 pr-4 font-semibold">{p.amount} {p.currency}</td>
                      <td className="py-2 pr-4">{new Date(p.createdAt).toLocaleDateString('fr-FR')}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Button size="sm" disabled={submittingId === p.id} onClick={() => act(p.id, 'approve')}>
                            <Check className="w-4 h-4 mr-1" /> Valider
                          </Button>
                          <Button size="sm" variant="outline" disabled={submittingId === p.id} onClick={() => act(p.id, 'reject')}>
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
