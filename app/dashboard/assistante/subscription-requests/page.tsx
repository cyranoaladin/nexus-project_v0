"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, CreditCard, Brain } from "lucide-react";
import { SUBSCRIPTION_PLANS, ARIA_ADDONS } from "@/lib/constants";
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
  const [overridePlanName, setOverridePlanName] = useState<string>("");
  const [overrideMonthlyPrice, setOverrideMonthlyPrice] = useState<number | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchRequests();
  }, [session, status, router, statusFilter]);

  const fetchRequests = async () => {
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
  };

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
          reason: action === 'REJECTED' ? rejectionReason : null,
          planName: (overridePlanName || selectedRequest?.planName) ?? undefined,
          monthlyPrice: (overrideMonthlyPrice ?? selectedRequest?.monthlyPrice) ?? undefined,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        setSelectedRequest(null);
        setRejectionReason('');
        setOverridePlanName("");
        setOverrideMonthlyPrice(null);
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
      case 'PLAN_CHANGE': return <CreditCard className="w-5 h-5 text-blue-600" />;
      case 'ARIA_ADDON': return <Brain className="w-5 h-5 text-purple-600" />;
      default: return <AlertCircle className="w-5 h-5 text-gray-600" />;
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
      case 'PENDING': return 'outline';
      case 'APPROVED': return 'default';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  if (status === "loading" || loading) {
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
          <Button 
            onClick={() => fetchRequests()} 
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
              <div className="flex items-center space-x-2">
                <CreditCard className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    Demandes d'Abonnement
                  </h1>
                  <p className="text-sm text-gray-500">Gestion des demandes de modification</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/assistante">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
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
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
              <Card key={request.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0">
                        {getRequestTypeIcon(request.requestType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {getRequestTypeText(request.requestType)}
                          </h3>
                          <Badge variant={getStatusBadgeVariant(request.status) as "default" | "destructive" | "outline" | "popular" | "success" | "warning" | null | undefined}>
                            {request.status === 'PENDING' ? 'En attente' : 
                             request.status === 'APPROVED' ? 'Approuvée' : 'Rejetée'}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">
                              <span className="font-medium">Élève:</span> {request.student.user.firstName} {request.student.user.lastName}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-medium">Parent:</span> {request.student.parent.user.firstName} {request.student.parent.user.lastName}
                            </p>
                            <p className="text-gray-600">
                              <span className="font-medium">Email:</span> {request.student.parent.user.email}
                            </p>
                          </div>
                          <div>
                            {request.planName && (
                              <p className="text-gray-600">
                                <span className="font-medium">Plan:</span> {request.planName}
                              </p>
                            )}
                            <p className="text-gray-600">
                              <span className="font-medium">Prix:</span> {request.monthlyPrice} TND/mois
                            </p>
                            <p className="text-gray-600">
                              <span className="font-medium">Demandé le:</span> {new Date(request.createdAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        
                        {request.reason && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-700">
                              <span className="font-medium">Raison:</span> {request.reason}
                            </p>
                          </div>
                        )}
                        
                        {request.rejectionReason && (
                          <div className="mt-3 p-3 bg-red-50 rounded-lg">
                            <p className="text-sm text-red-700">
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
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="bg-red-600 hover:bg-red-700 text-white"
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
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune demande {statusFilter === 'PENDING' ? 'en attente' : statusFilter === 'APPROVED' ? 'approuvée' : 'rejetée'}
              </h3>
              <p className="text-gray-500">
                {statusFilter === 'PENDING' ? 'Toutes les demandes ont été traitées.' : 'Aucune demande trouvée.'}
              </p>
            </div>
          )}
        </div>

        {/* Action Dialog */}
        <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedRequest?.status === 'PENDING' ? 'Traiter la demande' : 'Détails de la demande'}
              </DialogTitle>
            </DialogHeader>
            <DialogDescription className="sr-only">Fenêtre de traitement des demandes d'abonnement</DialogDescription>
            
            {selectedRequest && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Détails de la demande</h4>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm">
                    <p><strong>Type:</strong> {getRequestTypeText(selectedRequest.requestType)}</p>
                    <p><strong>Élève:</strong> {selectedRequest.student.user.firstName} {selectedRequest.student.user.lastName}</p>
                    <p><strong>Parent:</strong> {selectedRequest.student.parent.user.firstName} {selectedRequest.student.parent.user.lastName}</p>
                    {selectedRequest.planName && <p><strong>Plan:</strong> {selectedRequest.planName}</p>}
                    <p><strong>Prix:</strong> {selectedRequest.monthlyPrice} TND/mois</p>
                    {selectedRequest.reason && <p><strong>Raison:</strong> {selectedRequest.reason}</p>}
                  </div>
                </div>
                
                {selectedRequest.requestType === 'PLAN_CHANGE' && (
                  <div className="bg-blue-50 p-3 rounded-lg space-y-3">
                    <h4 className="font-medium">Formule à appliquer (obligatoire si manquante)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Formule</label>
                        <Select value={overridePlanName} onValueChange={setOverridePlanName}>
                          <SelectTrigger className="w-full"><SelectValue placeholder="Choisir une formule" /></SelectTrigger>
                          <SelectContent>
                            {Object.values(SUBSCRIPTION_PLANS as any).map((plan: any) => (
                              <SelectItem key={plan.name} value={plan.name}>{plan.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Prix mensuel (TND)</label>
                        <input
                          type="number"
                          className="w-full border rounded-md px-3 py-2 text-sm"
                          value={overrideMonthlyPrice ?? ''}
                          onChange={(e) => setOverrideMonthlyPrice(e.target.value ? Number(e.target.value) : null)}
                          placeholder="ex: 300"
                        />
                        <p className="text-xs text-gray-500 mt-1">Laissez vide pour reprendre le prix proposé ({selectedRequest.monthlyPrice} TND)</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedRequest.requestType === 'ARIA_ADDON' && (
                  <div className="bg-purple-50 p-3 rounded-lg space-y-3">
                    <h4 className="font-medium">Add-on ARIA à appliquer</h4>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Add-on</label>
                      <Select
                        value={overridePlanName}
                        onValueChange={setOverridePlanName}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir un add-on" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ARIA_ADDONS as any).map(([key, addon]: any) => (
                            <SelectItem key={key} value={`ARIA_${key}`}>
                              {addon.name} (+{addon.price} TND/mois)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">Obligatoire si la demande ne précise pas l'add-on.</p>
                    </div>
                  </div>
                )}

                {selectedRequest.status === 'PENDING' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
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
                        className="bg-green-600 hover:bg-green-700"
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
                        className="bg-red-600 hover:bg-red-700 text-white"
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