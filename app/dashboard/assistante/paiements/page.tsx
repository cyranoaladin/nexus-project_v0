"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle, Clock, CreditCard, Loader2, LogOut, XCircle } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PaymentMetadata = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface Payment {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  externalId?: string;
  description?: string;
  metadata?: PaymentMetadata;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export default function PaiementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchPayments();
  }, [session, status, router]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/assistant/payments');

      if (!response.ok) {
        throw new Error('Failed to fetch payments');
      }

      const data = await response.json();
      setPayments(data);
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updatePaymentStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/assistant/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update payment status');
      }

      // Refresh the list
      fetchPayments();
    } catch (err) {
      console.error('Error updating payment status:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="destructive" className="flex items-center gap-1"><Clock className="w-3 h-3" />En attente</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Validé</Badge>;
      case 'FAILED':
        return <Badge variant="outline" className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" />Échoué</Badge>;
      case 'REFUNDED':
        return <Badge variant="outline" className="flex items-center gap-1 text-orange-600"><XCircle className="w-3 h-3" />Remboursé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'SUBSCRIPTION':
        return <Badge variant="outline" className="text-blue-600">Abonnement</Badge>;
      case 'CREDIT_PACK':
        return <Badge variant="outline" className="text-green-600">Pack Crédits</Badge>;
      case 'SPECIAL_PACK':
        return <Badge variant="outline" className="text-purple-600">Pack Spécial</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const filteredPayments = payments.filter(payment => {
    if (filter === 'all') return true;
    return payment.status === filter.toUpperCase();
  });

  const formatMetadata = (metadata: PaymentMetadata) => {
    if (metadata === null || metadata === undefined) {
      return '';
    }

    if (typeof metadata === 'string') {
      return metadata;
    }

    if (typeof metadata === 'number' || typeof metadata === 'boolean') {
      return metadata.toString();
    }

    try {
      return JSON.stringify(metadata, null, 2);
    } catch {
      return String(metadata);
    }
  };

  if (status === "loading" || loading) {
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
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" asChild>
                <Link href="/dashboard/assistante">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour au tableau de bord
                </Link>
              </Button>
              <div className="flex items-center space-x-2">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900 text-sm md:text-base">
                    Gestion des Paiements
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500">Validation des paiements</p>
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Tous ({payments.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              En attente ({payments.filter(p => p.status === 'PENDING').length})
            </Button>
            <Button
              variant={filter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('completed')}
            >
              Validés ({payments.filter(p => p.status === 'COMPLETED').length})
            </Button>
            <Button
              variant={filter === 'failed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('failed')}
            >
              Échoués ({payments.filter(p => p.status === 'FAILED').length})
            </Button>
          </div>
        </div>

        {/* Payments List */}
        <div className="grid gap-6">
          {filteredPayments.length > 0 ? (
            filteredPayments.map((payment) => (
              <Card key={payment.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {payment.user ? `${payment.user.firstName} ${payment.user.lastName}` : 'Utilisateur inconnu'}
                      </CardTitle>
                      <p className="text-sm text-gray-600">{payment.user?.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(payment.status)}
                      {getTypeBadge(payment.type)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Montant:</span>
                        <span className="text-lg font-bold text-green-600">
                          {payment.amount} {payment.currency}
                        </span>
                      </div>
                      {payment.externalId && (
                        <div className="flex items-center space-x-2">
                          <CreditCard className="w-4 h-4 text-gray-500" />
                          <span className="text-sm">ID: {payment.externalId}</span>
                        </div>
                      )}
                      {payment.description && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Description:</span>
                          <p className="text-sm text-gray-600">{payment.description}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          Créé le {new Date(payment.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      {payment.metadata && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Métadonnées:</span>
                          <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                            {formatMetadata(payment.metadata)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {payment.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updatePaymentStatus(payment.id, 'COMPLETED')}
                        >
                          Valider le paiement
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updatePaymentStatus(payment.id, 'FAILED')}
                        >
                          Marquer comme échoué
                        </Button>
                      </>
                    )}
                    {payment.status === 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePaymentStatus(payment.id, 'REFUNDED')}
                      >
                        Rembourser
                      </Button>
                    )}
                    {payment.status === 'FAILED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePaymentStatus(payment.id, 'PENDING')}
                      >
                        Remettre en attente
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {filter === 'all'
                    ? 'Aucun paiement trouvé'
                    : `Aucun paiement ${filter === 'pending' ? 'en attente' : filter === 'completed' ? 'validé' : 'échoué'}`
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
