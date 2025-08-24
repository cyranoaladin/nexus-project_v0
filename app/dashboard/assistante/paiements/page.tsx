"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface PaymentItem {
  id: string;
  userEmail: string;
  amount: number;
  status: string;
  type: string;
  createdAt: string;
}

export default function AssistantPaymentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push('/auth/signin');
      return;
    }
    fetchPayments();
  }, [session, status, router]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/assistant/payments');
      if (!res.ok) throw new Error('Failed to fetch payments');
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  const updatePayment = async (id: string, action: 'approve' | 'reject') => {
    try {
      setProcessing(id);
      const res = await fetch('/api/assistant/payments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) throw new Error('Failed to update payment');
      await fetchPayments();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error');
    } finally {
      setProcessing(null);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des paiements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">Erreur lors du chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button onClick={fetchPayments} className="mt-4">Réessayer</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-6 h-6 text-green-600" />
              <h1 className="font-semibold text-gray-900">Validation des Paiements</h1>
            </div>
            <Badge variant="outline">{payments.length} paiements</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Paiements en attente / récents</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-sm text-gray-600">Aucun paiement à afficher.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Utilisateur</th>
                      <th className="text-left p-2">Montant</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Statut</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => (
                      <tr key={p.id} className="border-t">
                        <td className="p-2">{p.userEmail}</td>
                        <td className="p-2">{p.amount} TND</td>
                        <td className="p-2">{p.type}</td>
                        <td className="p-2">
                          <Badge
                            variant={
                              (p.status === 'PENDING'
                                ? 'outline'
                                : p.status === 'COMPLETED'
                                  ? 'default'
                                  : 'destructive') as 'default' | 'success' | 'outline' | 'popular' | 'warning' | 'destructive' | null | undefined
                            }
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="p-2">{new Date(p.createdAt).toLocaleString('fr-FR')}</td>
                        <td className="p-2 space-x-2">
                          {p.status === 'PENDING' && (
                            <>
                              <Button size="sm" onClick={() => updatePayment(p.id, 'approve')} disabled={processing === p.id}> 
                                {processing === p.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                                Approuver
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => updatePayment(p.id, 'reject')} disabled={processing === p.id}>
                                Rejeter
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
