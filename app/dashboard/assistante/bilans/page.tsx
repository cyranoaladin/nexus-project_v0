"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle, Clock, Loader2, LogOut, Mail, Phone, User, XCircle } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BilanRequest {
  id: string;
  studentName: string;
  parentName: string;
  email: string;
  phone: string;
  grade: string;
  subjects: string[];
  status: string;
  notes?: string;
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function BilansPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [bilans, setBilans] = useState<BilanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    fetchBilans();
  }, [session, status, router]);

  const fetchBilans = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/assistant/bilans');

      if (!response.ok) {
        throw new Error('Failed to fetch bilans');
      }

      const data = await response.json();
      setBilans(data);
    } catch (err) {
      console.error('Error fetching bilans:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const updateBilanStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/assistant/bilans/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update bilan status');
      }

      // Refresh the list
      fetchBilans();
    } catch (err) {
      console.error('Error updating bilan status:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="destructive" className="flex items-center gap-1"><Clock className="w-3 h-3" />En attente</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" />En cours</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" />Terminé</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline" className="flex items-center gap-1 text-red-600"><XCircle className="w-3 h-3" />Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredBilans = bilans.filter(bilan => {
    if (filter === 'all') return true;
    return bilan.status === filter.toUpperCase();
  });

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des demandes de bilans...</p>
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
                <User className="w-6 h-6 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900 text-sm md:text-base">
                    Gestion des Bilans Gratuits
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500">Demandes de bilans pédagogiques</p>
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
              Tous ({bilans.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              En attente ({bilans.filter(b => b.status === 'PENDING').length})
            </Button>
            <Button
              variant={filter === 'in_progress' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('in_progress')}
            >
              En cours ({bilans.filter(b => b.status === 'IN_PROGRESS').length})
            </Button>
            <Button
              variant={filter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('completed')}
            >
              Terminés ({bilans.filter(b => b.status === 'COMPLETED').length})
            </Button>
          </div>
        </div>

        {/* Bilans List */}
        <div className="grid gap-6">
          {filteredBilans.length > 0 ? (
            filteredBilans.map((bilan) => (
              <Card key={bilan.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{bilan.studentName}</CardTitle>
                      <p className="text-sm text-gray-600">Parent: {bilan.parentName}</p>
                    </div>
                    {getStatusBadge(bilan.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{bilan.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{bilan.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">Classe: {bilan.grade}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Matières:</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {bilan.subjects.map((subject, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {subject}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">
                          Demandé le {new Date(bilan.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {bilan.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Notes:</strong> {bilan.notes}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {bilan.status === 'PENDING' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateBilanStatus(bilan.id, 'IN_PROGRESS')}
                        >
                          Commencer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateBilanStatus(bilan.id, 'CANCELLED')}
                        >
                          Annuler
                        </Button>
                      </>
                    )}
                    {bilan.status === 'IN_PROGRESS' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => updateBilanStatus(bilan.id, 'COMPLETED')}
                        >
                          Terminer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateBilanStatus(bilan.id, 'PENDING')}
                        >
                          Remettre en attente
                        </Button>
                      </>
                    )}
                    {bilan.status === 'COMPLETED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateBilanStatus(bilan.id, 'IN_PROGRESS')}
                      >
                        Rouvrir
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">
                  {filter === 'all'
                    ? 'Aucune demande de bilan trouvée'
                    : `Aucune demande ${filter === 'pending' ? 'en attente' : filter === 'in_progress' ? 'en cours' : 'terminée'}`
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
