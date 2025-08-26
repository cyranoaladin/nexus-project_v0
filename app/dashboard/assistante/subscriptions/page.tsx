'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Check, Loader2, LogOut, Search, Settings, X } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface SubscriptionRequest {
  id: string;
  planName: string;
  planType: string;
  monthlyPrice: number;
  creditsPerMonth: number;
  status: string;
  createdAt: string;
  requestedBy: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    grade: string;
    school: string;
  };
  parent: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function SubscriptionsManagement() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pendingSubscriptions, setPendingSubscriptions] = useState<SubscriptionRequest[]>([]);
  const [allSubscriptions, setAllSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SubscriptionRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push('/auth/signin');
      return;
    }

    fetchSubscriptions();
  }, [session, status, router]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/assistant/subscriptions');

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const data = await response.json();
      setPendingSubscriptions(data.pendingSubscriptions);
      setAllSubscriptions(data.allSubscriptions);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscriptionAction = async (subscriptionId: string, action: 'approve' | 'reject') => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/assistant/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId,
          action,
          reason: action === 'reject' ? rejectionReason : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process subscription');
      }

      const result = await response.json();
      alert(result.subscription.message);

      // Reset form
      setSelectedRequest(null);
      setRejectionReason('');

      // Refresh data
      fetchSubscriptions();
    } catch (err) {
      console.error('Error processing subscription:', err);
      alert(err instanceof Error ? err.message : 'Failed to process subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredPendingSubscriptions = pendingSubscriptions.filter(
    (sub) =>
      sub.student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.parent.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.parent.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.planName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des demandes...</p>
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
          <Button onClick={() => fetchSubscriptions()} className="mt-4">
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
              <Link href="/dashboard/assistante" className="flex items-center space-x-2">
                <Settings className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">Gestion des Abonnements</h1>
                  <p className="text-sm text-gray-500">Approbation des demandes</p>
                </div>
              </Link>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Demandes d'Abonnements</h2>
              <p className="text-gray-600">Gérez les demandes d'abonnements des parents</p>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-sm">
                {pendingSubscriptions.length} en attente
              </Badge>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Rechercher une demande..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Pending Requests */}
        <div className="space-y-4">
          {filteredPendingSubscriptions.length > 0 ? (
            filteredPendingSubscriptions.map((request) => (
              <Card key={request.id} className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {request.planName} - {request.student.firstName} {request.student.lastName}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        Demandé par {request.parent.firstName} {request.parent.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString('fr-FR')} à{' '}
                        {new Date(request.createdAt).toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-orange-700 border-orange-300">
                      En attente
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Élève</p>
                      <p className="text-sm text-gray-600">
                        {request.student.firstName} {request.student.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {request.student.grade} - {request.student.school}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Abonnement</p>
                      <p className="text-sm text-gray-600">{request.planName}</p>
                      <p className="text-xs text-gray-500">{request.monthlyPrice} TND/mois</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Crédits</p>
                      <p className="text-sm text-gray-600">
                        {request.creditsPerMonth} crédits/mois
                      </p>
                      <p className="text-xs text-gray-500">Type: {request.planType}</p>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Voir Détails
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Détails de la Demande</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium">Élève</Label>
                              <p className="text-sm">
                                {request.student.firstName} {request.student.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{request.student.grade}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium">Parent</Label>
                              <p className="text-sm">
                                {request.parent.firstName} {request.parent.lastName}
                              </p>
                              <p className="text-xs text-gray-500">{request.parent.email}</p>
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">Abonnement</Label>
                            <p className="text-sm font-medium">{request.planName}</p>
                            <p className="text-sm">{request.monthlyPrice} TND/mois</p>
                            <p className="text-xs text-gray-500">
                              {request.creditsPerMonth} crédits inclus
                            </p>
                          </div>

                          <div className="flex space-x-2">
                            <Button
                              onClick={() => handleSubscriptionAction(request.id, 'approve')}
                              className="flex-1"
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  Traitement...
                                </>
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-2" />
                                  Approuver
                                </>
                              )}
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  disabled={isProcessing}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Rejeter
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Rejeter la Demande</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="rejectionReason">Raison du rejet</Label>
                                    <Textarea
                                      id="rejectionReason"
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      placeholder="Expliquez pourquoi cette demande est rejetée..."
                                      rows={3}
                                    />
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button
                                      onClick={() => handleSubscriptionAction(request.id, 'reject')}
                                      variant="secondary"
                                      className="flex-1"
                                      disabled={isProcessing}
                                    >
                                      {isProcessing ? (
                                        <>
                                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                          Traitement...
                                        </>
                                      ) : (
                                        'Rejeter'
                                      )}
                                    </Button>
                                    <Button variant="outline" className="flex-1">
                                      Annuler
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <Check className="w-16 h-16 text-green-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune demande en attente</h3>
              <p className="text-gray-500">
                {searchTerm
                  ? 'Aucune demande ne correspond à votre recherche.'
                  : 'Toutes les demandes ont été traitées.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
