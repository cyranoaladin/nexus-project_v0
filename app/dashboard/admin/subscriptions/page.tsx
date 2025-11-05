"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CreditCard, Edit, Loader2, LogOut, Search } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Subscription {
  id: string;
  planName: string;
  monthlyPrice: number;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    grade: string;
    school: string;
  };
  parent: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface SubscriptionUpdateForm {
  status: string;
  endDate: string;
}

export default function SubscriptionsManagementPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ACTIVE");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editFormState, setEditFormState] = useState<SubscriptionUpdateForm>({ status: "ACTIVE", endDate: "" });

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        status: statusFilter,
        search: searchTerm
      });
      
      const response = await fetch(`/api/admin/subscriptions?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }
      
      const data = await response.json();
      setSubscriptions(data.subscriptions);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, searchTerm]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push("/auth/signin");
      return;
    }

    fetchSubscriptions();
  }, [session, status, router, fetchSubscriptions]);

  const handleUpdateSubscription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSubscription) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/subscriptions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: selectedSubscription.id,
          status: editFormState.status,
          endDate: editFormState.endDate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription');
      }

      const result = await response.json();
      alert(result.message);
      
      // Reset form and refresh
      setSelectedSubscription(null);
      setEditFormState({ status: 'ACTIVE', endDate: '' });
      setIsDialogOpen(false);
      fetchSubscriptions();
    } catch (err) {
      console.error('Error updating subscription:', err);
      alert(err instanceof Error ? err.message : 'Failed to update subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setEditFormState({
      status: subscription.status,
      endDate: subscription.endDate ? subscription.endDate.slice(0, 10) : ''
    });
    setIsDialogOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'default';
      case 'INACTIVE': return 'secondary';
      case 'REJECTED': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Actif';
      case 'INACTIVE': return 'Inactif';
      case 'REJECTED': return 'Rejeté';
      default: return status;
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des abonnements...</p>
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
            onClick={() => fetchSubscriptions()} 
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
                <CreditCard className="w-8 h-8 text-green-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    Gestion des Abonnements
                  </h1>
                  <p className="text-sm text-gray-500">Administration des abonnements actifs</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/admin">
                <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
                  Retour au Dashboard
                </Button>
              </Link>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Abonnements Actifs
              </h2>
              <p className="text-gray-600">
                Gérez tous les abonnements de la plateforme
              </p>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-sm">
                {subscriptions.length} abonnements
              </Badge>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Rechercher un abonnement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les statuts</SelectItem>
              <SelectItem value="ACTIVE">Actifs</SelectItem>
              <SelectItem value="INACTIVE">Inactifs</SelectItem>
              <SelectItem value="REJECTED">Rejetés</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subscriptions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Abonnements ({subscriptions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Élève</th>
                    <th className="text-left py-3 px-4">Parent</th>
                    <th className="text-left py-3 px-4">Plan</th>
                    <th className="text-left py-3 px-4">Prix</th>
                    <th className="text-left py-3 px-4">Statut</th>
                    <th className="text-left py-3 px-4">Date de fin</th>
                    <th className="text-left py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{subscription.student.firstName} {subscription.student.lastName}</p>
                          <p className="text-sm text-gray-500">{subscription.student.email}</p>
                          <p className="text-xs text-gray-400">{subscription.student.grade} - {subscription.student.school}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium">{subscription.parent.firstName} {subscription.parent.lastName}</p>
                          <p className="text-sm text-gray-500">{subscription.parent.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">
                          {subscription.planName}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{subscription.monthlyPrice} TND/mois</p>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(subscription.status) as "default" | "outline" | "popular" | "success" | "warning" | "destructive" | null | undefined}>
                          {getStatusText(subscription.status)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString('fr-FR') : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(subscription)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </Button>
                  <span className="flex items-center px-3 py-2 text-sm">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Subscription Dialog */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setSelectedSubscription(null);
              setEditFormState({ status: 'ACTIVE', endDate: '' });
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modifier l'Abonnement</DialogTitle>
            </DialogHeader>
            {selectedSubscription && (
              <form onSubmit={handleUpdateSubscription} className="space-y-4">
                <div>
                  <Label>Élève</Label>
                  <p className="text-sm text-gray-600">
                    {selectedSubscription.student.firstName} {selectedSubscription.student.lastName}
                  </p>
                </div>
                
                <div>
                  <Label>Plan</Label>
                  <p className="text-sm text-gray-600">
                    {selectedSubscription.planName} - {selectedSubscription.monthlyPrice} TND/mois
                  </p>
                </div>

                <div>
                  <Label htmlFor="status">Statut</Label>
                  <Select
                    value={editFormState.status}
                    onValueChange={(value) => setEditFormState((prev) => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Actif</SelectItem>
                      <SelectItem value="INACTIVE">Inactif</SelectItem>
                      <SelectItem value="REJECTED">Rejeté</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="endDate">Date de fin</Label>
                  <Input
                    type="date"
                    value={editFormState.endDate}
                    onChange={(event) => setEditFormState((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      'Modifier'
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
} 