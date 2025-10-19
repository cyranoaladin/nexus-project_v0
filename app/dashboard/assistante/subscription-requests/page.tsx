"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle, Clock, CreditCard, Loader2, LogOut, XCircle } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SubscriptionRequest {
  id: string;
  studentId: string;
  planName: string;
  monthlyPrice: number;
  creditsPerMonth: number;
  status: string;
  notes?: string;
  createdAt: string;
  student?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
}

export default function SubscriptionRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchSubscriptionRequests();
  }, [session, status, router]);

  const fetchSubscriptionRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/assistant/subscription-requests');

      if (!response.ok) {
        throw new Error('Failed to fetch subscription requests');
      }

      const data = await response.json();
      setRequests(data);
    } catch (err) {
      console.error('Error fetching subscription requests:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateRequestStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/assistant/subscription-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription request status');
      }

      // Refresh the list
      fetchSubscriptionRequests();
    } catch (err) {
      console.error('Error updating subscription request status:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="destructive" className="flex items-center gap-1"><Clock className="w-3 h-3" />En attente</Badge>;
      case 'APPROVED':
        return <Badge variant="outline" className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Approuvé</Badge>;
      case 'REJECTED':
        return <Badge variant="outline" className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" />Rejeté</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (planName: string) => {
    switch (planName) {
      case 'ACCES_PLATEFORME':
        return <Badge variant="outline" className="text-blue-600">Accès Plateforme</Badge>;
      case 'HYBRIDE':
        return <Badge variant="outline" className="text-green-600">Hybride</Badge>;
      case 'IMMERSION':
        return <Badge variant="outline" className="text-purple-600">Immersion</Badge>;
      default:
        return <Badge variant="outline">{planName}</Badge>;
    }
  };

  const filteredRequests = requests.filter(request => {
    if (filter === 'all') return true;
    return request.status === filter.toUpperCase();
  });

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des demandes d'abonnement...</p>
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
                    Demandes d'Abonnement
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500">Gestion des demandes d'abonnement</p>
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
              Tous ({requests.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              En attente ({requests.filter(r => r.status === 'PENDING').length})
            </Button>
            <Button
              variant={filter === 'approved' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('approved')}
            >
              Approuvés ({requests.filter(r => r.status === 'APPROVED').length})
            </Button>
            <Button
              variant={filter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('rejected')}
            >
              Rejetés ({requests.filter(r => r.status === 'REJECTED').length})
            </Button>
          </div>
        </div>

        {/* Requests List */}
        <div className="grid gap-6">
          {filteredRequests.length > 0 ? (
            filteredRequests.map((request) => (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {request.student ? `${request.student.firstName} ${request.student.lastName}` : 'Élève inconnu'}
                      </CardTitle>
                      <p className="text-sm text-gray-600">{request.student?.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(request.status)}
                      {getPlanBadge(request.planName)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Prix mensuel:</span>
                        <span className="text-lg font-bold text-green-600">
                          {request.monthlyPrice} TND
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Crédits/mois:</span>
                        <span className="text-lg font-bold text-blue-600">
                          {request.creditsPerMonth}
                        </span>
                      </div>
                      {request.notes && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Notes:</span>
                          <p className="text-sm text-gray-600">{request.notes}</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          Demandé le {new Date(request.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {request.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateRequestStatus(request.id, 'APPROVED')}
                        >
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateRequestStatus(request.id, 'REJECTED')}
                        >
                          Rejeter
                        </Button>
                      </>
                    )}
                    {request.status === 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateRequestStatus(request.id, 'PENDING')}
                      >
                        Remettre en attente
                      </Button>
                    )}
                    {request.status === 'REJECTED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateRequestStatus(request.id, 'PENDING')}
                      >
                        Reconsidérer
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
                    ? 'Aucune demande d\'abonnement trouvée'
                    : `Aucune demande ${filter === 'pending' ? 'en attente' : filter === 'approved' ? 'approuvée' : 'rejetée'}`
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
