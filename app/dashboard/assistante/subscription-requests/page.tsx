"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, CreditCard, Brain } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SubscriptionRequest {
  id: string;
  studentId: string;
  requestType: string;
  planName: string | null;
  monthlyPrice: number;
  reason: string;
  status: string;
  requestedBy: string;
  requestedByEmail: string;
  createdAt: string;
  processedBy: string | null;
  processedAt: string | null;
  rejectionReason: string | null;
  student: {
    user: {
      firstName: string;
      lastName: string;
    };
    parent: {
      user: {
        firstName: string;
        lastName: string;
        email: string;
      };
    };
  };
}

export default function SubscriptionRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState<SubscriptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedRequest, setSelectedRequest] = useState<SubscriptionRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/assistant/subscription-requests?status=${statusFilter}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }
      
      const data = await response.json();
      setRequests(data.requests);
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchRequests();
  }, [session, status, router, fetchRequests]);

  const handleAction = async (requestId: string, action: 'APPROVED' | 'REJECTED') => {
    setProcessing(true);
    try {
      const response = await fetch('/api/assistant/subscription-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: requestId,
          action: action,
          reason: action === 'REJECTED' ? rejectionReason : null
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setSelectedRequest(null);
        setRejectionReason('');
        fetchRequests();
      } else {
        const errorData = await response.json();
        alert(`Erreur: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      alert('Une erreur est survenue lors du traitement');
    } finally {
      setProcessing(false);
    }
  };

  const getRequestTypeIcon = (type: string) => {
    switch (type) {
      case 'PLAN_CHANGE': return <CreditCard className="w-5 h-5 text-brand-accent" />;
      case 'ARIA_ADDON': return <Brain className="w-5 h-5 text-purple-300" />;
      default: return <AlertCircle className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getRequestTypeText = (type: string) => {
    switch (type) {
      case 'PLAN_CHANGE': return 'Changement de Formule';
      case 'ARIA_ADDON': return 'Ajout ARIA+';
      default: return type;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'PENDING': return 'secondary';
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

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
            onClick={() => fetchRequests()} 
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
              <div className="flex items-center space-x-2">
                <CreditCard className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white">
                    Demandes d'Abonnement
                  </h1>
                  <p className="text-sm text-neutral-400">Gestion des demandes de modification</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/assistante">
                <Button variant="ghost" className="text-neutral-300 hover:text-white">
                  Retour au Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 border-white/10 bg-surface-elevated text-neutral-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
              <SelectItem value="PENDING">En attente</SelectItem>
              <SelectItem value="APPROVED">Approuvées</SelectItem>
              <SelectItem value="REJECTED">Rejetées</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {requests.length > 0 ? (
            requests.map((request) => (
              <Card key={request.id} className="bg-surface-card border border-white/10 shadow-premium">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {getRequestTypeIcon(request.requestType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium text-white">
                            {getRequestTypeText(request.requestType)}
                          </h3>
                          <Badge variant={getStatusBadgeVariant(request.status) as "default" | "destructive" | "outline" | "popular" | "success" | "warning" | null | undefined} className="border-white/10">
                            {request.status === 'PENDING' ? 'En attente' : 
                             request.status === 'APPROVED' ? 'Approuvée' : 'Rejetée'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-neutral-300">
                              <span className="font-medium text-neutral-200">Élève:</span> {request.student.user.firstName} {request.student.user.lastName}
                            </p>
                            <p className="text-neutral-300">
                              <span className="font-medium text-neutral-200">Parent:</span> {request.student.parent.user.firstName} {request.student.parent.user.lastName}
                            </p>
                            <p className="text-neutral-300">
                              <span className="font-medium text-neutral-200">Email:</span> {request.student.parent.user.email}
                            </p>
                          </div>
                          <div>
                            {request.planName && (
                              <p className="text-neutral-300">
                                <span className="font-medium text-neutral-200">Plan:</span> {request.planName}
                              </p>
                            )}
                            <p className="text-neutral-300">
                              <span className="font-medium text-neutral-200">Prix:</span> {request.monthlyPrice} TND/mois
                            </p>
                            <p className="text-neutral-300">
                              <span className="font-medium text-neutral-200">Demandé le:</span> {new Date(request.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        
                        {request.reason && (
                          <div className="mt-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                            <p className="text-sm text-neutral-300">
                              <span className="font-medium text-neutral-200">Raison:</span> {request.reason}
                            </p>
                          </div>
                        )}
                        
                        {request.rejectionReason && (
                          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                            <p className="text-sm text-rose-200">
                              <span className="font-medium">Raison du rejet:</span> {request.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {request.status === 'PENDING' && (
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => setSelectedRequest(request)}
                          className="bg-emerald-500/80 hover:bg-emerald-500 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-rose-500/80 hover:bg-rose-500 text-white"
                          onClick={() => setSelectedRequest(request)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeter
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">
                Aucune demande {statusFilter === 'PENDING' ? 'en attente' : statusFilter === 'APPROVED' ? 'approuvée' : 'rejetée'}
              </h3>
              <p className="text-neutral-400">
                {statusFilter === 'PENDING' ? 'Toutes les demandes ont été traitées.' : 'Aucune demande trouvée.'}
              </p>
            </div>
          )}
        </div>

        {/* Action Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="bg-surface-card border border-white/10 text-neutral-100">
            <DialogHeader>
              <DialogTitle className="text-white">
                {selectedRequest?.status === 'PENDING' ? 'Traiter la demande' : 'Détails de la demande'}
              </DialogTitle>
            </DialogHeader>
            
            {selectedRequest && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 text-neutral-200">Détails de la demande</h4>
                  <div className="bg-white/5 border border-white/10 p-3 rounded-lg text-sm text-neutral-300">
                    <p><strong>Type:</strong> {getRequestTypeText(selectedRequest.requestType)}</p>
                    <p><strong>Élève:</strong> {selectedRequest.student.user.firstName} {selectedRequest.student.user.lastName}</p>
                    <p><strong>Parent:</strong> {selectedRequest.student.parent.user.firstName} {selectedRequest.student.parent.user.lastName}</p>
                    {selectedRequest.planName && <p><strong>Plan:</strong> {selectedRequest.planName}</p>}
                    <p><strong>Prix:</strong> {selectedRequest.monthlyPrice} TND/mois</p>
                    {selectedRequest.reason && <p><strong>Raison:</strong> {selectedRequest.reason}</p>}
                  </div>
                </div>
                
                {selectedRequest.status === 'PENDING' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-200 mb-2">
                        Raison du rejet (optionnel)
                      </label>
                      <Textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Expliquez pourquoi vous rejetez cette demande..."
                        rows={3}
                      />
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleAction(selectedRequest.id, 'APPROVED')}
                        disabled={processing}
                        className="bg-emerald-500/80 hover:bg-emerald-500 text-white"
                      >
                        {processing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Traitement...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approuver
                          </>
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        className="bg-rose-500/80 hover:bg-rose-500 text-white"
                        onClick={() => handleAction(selectedRequest.id, 'REJECTED')}
                        disabled={processing}
                      >
                        {processing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Traitement...
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-2" />
                            Rejeter
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-white/10 text-neutral-200 hover:text-white"
                        onClick={() => setSelectedRequest(null)}
                        disabled={processing}
                      >
                        Annuler
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
} 
