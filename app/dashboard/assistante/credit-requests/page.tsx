"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Check, Clock, CreditCard, Loader2, LogOut, Search, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CreditRequest {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
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

export default function CreditRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [creditRequests, setCreditRequests] = useState<CreditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<CreditRequest | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchCreditRequests();
  }, [session, status, router]);

  const fetchCreditRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/assistant/credit-requests');
      
      if (!response.ok) {
        throw new Error('Failed to fetch credit requests');
      }
      
      const data = await response.json();
      setCreditRequests(data.creditRequests);
    } catch (err) {
      console.error('Error fetching credit requests:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreditRequestAction = async (requestId: string, action: 'approve' | 'reject') => {
    if (!selectedRequest) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/assistant/credit-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId,
          action,
          reason: action === 'reject' ? rejectionReason : undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process credit request');
      }

      const result = await response.json();
      alert(result.message);
      
      // Reset form
      setSelectedRequest(null);
      setRejectionReason("");
      
      // Refresh data
      fetchCreditRequests();
    } catch (err) {
      console.error('Error processing credit request:', err);
      alert(err instanceof Error ? err.message : 'Failed to process credit request');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredCreditRequests = creditRequests.filter(request =>
    request.student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.parent.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.parent.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            onClick={() => fetchCreditRequests()} 
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
                    Gestion des Demandes de Crédits
                  </h1>
                  <p className="text-sm text-gray-500">Approbation des achats de crédits</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Demandes de Crédits
              </h2>
              <p className="text-gray-600">
                Gérez les demandes d'achat de crédits des parents
              </p>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-sm">
                {creditRequests.length} demandes
              </Badge>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Rechercher une demande..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Credit Requests */}
        <div className="space-y-4">
          {filteredCreditRequests.length > 0 ? (
            filteredCreditRequests.map((request) => (
              <Card key={request.id} className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        Demande de {request.amount} crédits - {request.student.firstName} {request.student.lastName}
                      </CardTitle>
                      <p className="text-sm text-gray-600">
                        Demandé par {request.parent.firstName} {request.parent.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(request.createdAt).toLocaleDateString('fr-FR')} à {new Date(request.createdAt).toLocaleTimeString('fr-FR')}
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
                      <p className="text-sm text-gray-600">{request.student.firstName} {request.student.lastName}</p>
                      <p className="text-xs text-gray-500">{request.student.grade} - {request.student.school}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Parent</p>
                      <p className="text-sm text-gray-600">{request.parent.firstName} {request.parent.lastName}</p>
                      <p className="text-xs text-gray-500">{request.parent.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">Crédits</p>
                      <p className="text-sm text-gray-600">{request.amount} crédits</p>
                      <p className="text-xs text-gray-500">Demande en attente</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Description</p>
                    <p className="text-sm text-gray-600 bg-white p-3 rounded-lg">
                      {request.description}
                    </p>
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
                              <p className="text-sm font-medium">Élève</p>
                              <p className="text-sm">{request.student.firstName} {request.student.lastName}</p>
                              <p className="text-xs text-gray-500">{request.student.grade}</p>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Parent</p>
                              <p className="text-sm">{request.parent.firstName} {request.parent.lastName}</p>
                              <p className="text-xs text-gray-500">{request.parent.email}</p>
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-sm font-medium">Crédits demandés</p>
                            <p className="text-lg font-bold text-blue-600">{request.amount} crédits</p>
                          </div>

                          <div>
                            <p className="text-sm font-medium">Description</p>
                            <p className="text-sm bg-gray-50 p-3 rounded-lg">
                              {request.description}
                            </p>
                          </div>

                          <div className="flex space-x-2">
                            <Button 
                              onClick={() => handleCreditRequestAction(request.id, 'approve')}
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
                                    <p className="text-sm font-medium mb-2">Raison du rejet</p>
                                    <Textarea
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      placeholder="Expliquez pourquoi cette demande est rejetée..."
                                      rows={3}
                                    />
                                  </div>
                                  <div className="flex space-x-2">
                                    <Button 
                                      onClick={() => handleCreditRequestAction(request.id, 'reject')}
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
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucune demande en attente
              </h3>
              <p className="text-gray-500">
                {searchTerm ? 'Aucune demande ne correspond à votre recherche.' : 'Toutes les demandes ont été traitées.'}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
} 