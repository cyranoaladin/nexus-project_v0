"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, Loader2, LogOut, Search, Settings, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<SubscriptionRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
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
    } catch (err) {
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
          reason: action === 'reject' ? rejectionReason : undefined
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
      setRejectionReason("");
      
      // Refresh data
      fetchSubscriptions();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to process subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredPendingSubscriptions = pendingSubscriptions.filter(sub =>
    sub.student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.parent.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.parent.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.planName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des demandes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button 
            onClick={() => fetchSubscriptions()} 
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/assistante" className="flex items-center space-x-2">
                <Settings className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white">
                    Gestion des Abonnements
                  </h1>
                  <p className="text-sm text-neutral-400">Approbation des demandes</p>
                </div>
              </Link>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-neutral-300 hover:text-white"
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
              <h2 className="text-2xl font-bold text-white mb-2">
                Demandes d'Abonnements
              </h2>
              <p className="text-neutral-400">
                Gérez les demandes d'abonnements des parents
              </p>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-sm border-white/10 text-neutral-300">
                {pendingSubscriptions.length} en attente
              </Badge>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
            <Input
              placeholder="Rechercher une demande..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-surface-elevated border-white/10 text-neutral-100"
            />
          </div>
        </div>

        {/* Pending Requests */}
        <div className="space-y-4">
          {filteredPendingSubscriptions.length > 0 ? (
            filteredPendingSubscriptions.map((request) => (
              <Card key={request.id} className="border-blue-500/20 bg-blue-500/10">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg text-white">
                        {request.planName} - {request.student.firstName} {request.student.lastName}
                      </CardTitle>
                      <p className="text-sm text-neutral-300">
                        Demandé par {request.parent.firstName} {request.parent.lastName}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {new Date(request.createdAt).toLocaleDateString('fr-FR')} à {new Date(request.createdAt).toLocaleTimeString('fr-FR')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-slate-200 border-blue-500/30">
                      En attente
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Élève</p>
                      <p className="text-sm text-neutral-300">{request.student.firstName} {request.student.lastName}</p>
                      <p className="text-xs text-neutral-400">{request.student.grade} - {request.student.school}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Abonnement</p>
                      <p className="text-sm text-neutral-300">{request.planName}</p>
                      <p className="text-xs text-neutral-400">{request.monthlyPrice} TND/mois</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-200">Crédits</p>
                      <p className="text-sm text-neutral-300">{request.creditsPerMonth} crédits/mois</p>
                      <p className="text-xs text-neutral-400">Type: {request.planType}</p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-white/10 text-neutral-200 hover:text-white"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Voir Détails
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-surface-card border border-white/10 text-neutral-100">
                        <DialogHeader>
                          <DialogTitle className="text-white">Détails de la Demande</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-sm font-medium text-neutral-200">Élève</Label>
                              <p className="text-sm text-neutral-300">{request.student.firstName} {request.student.lastName}</p>
                              <p className="text-xs text-neutral-400">{request.student.grade}</p>
                            </div>
                            <div>
                              <Label className="text-sm font-medium text-neutral-200">Parent</Label>
                              <p className="text-sm text-neutral-300">{request.parent.firstName} {request.parent.lastName}</p>
                              <p className="text-xs text-neutral-400">{request.parent.email}</p>
                            </div>
                          </div>
                          
                          <div>
                            <Label className="text-sm font-medium text-neutral-200">Abonnement</Label>
                            <p className="text-sm font-medium text-neutral-100">{request.planName}</p>
                            <p className="text-sm text-neutral-300">{request.monthlyPrice} TND/mois</p>
                            <p className="text-xs text-neutral-400">{request.creditsPerMonth} crédits inclus</p>
                          </div>

                          <div className="flex space-x-2">
                            <Button 
                              onClick={() => handleSubscriptionAction(request.id, 'approve')}
                              className="flex-1 btn-primary"
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
                                  className="flex-1 border-white/10 text-neutral-200 hover:text-white"
                                  disabled={isProcessing}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Rejeter
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-surface-card border border-white/10 text-neutral-100">
                                <DialogHeader>
                                  <DialogTitle className="text-white">Rejeter la Demande</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="rejectionReason" className="text-neutral-200">Raison du rejet</Label>
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
                                      className="flex-1 btn-secondary"
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
                                    <Button variant="outline" className="flex-1 border-white/10 text-neutral-200 hover:text-white">
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
              <Check className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Aucune demande en attente
              </h3>
              <p className="text-neutral-400">
                {searchTerm ? 'Aucune demande ne correspond à votre recherche.' : 'Toutes les demandes ont été traitées.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 
