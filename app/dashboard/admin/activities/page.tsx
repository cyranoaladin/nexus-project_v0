"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Activity, CreditCard, Loader2, LogOut, Search, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  time: string;
  status: string;
  studentName: string;
  coachName: string;
  subject: string;
  action: string;
}

export default function ActivitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        type: typeFilter,
        search: searchTerm
      });
      
      const response = await fetch(`/api/admin/activities?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch activities');
      }
      
      const data = await response.json();
      setActivities(data.activities);
      setTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [currentPage, typeFilter, searchTerm]);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push("/auth/signin");
      return;
    }

    fetchActivities();
  }, [session, status, router, fetchActivities]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'session': return <Activity className="w-5 h-5 text-brand-accent" />;
      case 'user': return <Users className="w-5 h-5 text-emerald-300" />;
      case 'subscription': return <CreditCard className="w-5 h-5 text-purple-300" />;
      case 'credit': return <CreditCard className="w-5 h-5 text-amber-300" />;
      default: return <Activity className="w-5 h-5 text-neutral-400" />;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case 'session': return 'Session';
      case 'user': return 'Utilisateur';
      case 'subscription': return 'Abonnement';
      case 'credit': return 'Crédit';
      default: return type;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'default';
      case 'SUCCESS': return 'success';
      case 'WARNING': return 'warning';
      case 'DESTRUCTIVE': return 'destructive';
      case 'CREATED': return 'outline';
      default: return 'outline';
    }
  };

  const filteredActivities = activities.filter(activity =>
    activity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.coachName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    activity.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement des activités...</p>
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
            onClick={() => fetchActivities()} 
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
                <Activity className="w-8 h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white">
                    Activités du Système
                  </h1>
                  <p className="text-sm text-neutral-400">Historique complet des activités</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/admin">
                <Button variant="ghost" className="text-neutral-300 hover:text-white">
                  Retour au Dashboard
                </Button>
              </Link>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Activités du Système
              </h2>
              <p className="text-neutral-400">
                Historique complet de toutes les activités de la plateforme
              </p>
            </div>
            <div className="flex space-x-2">
              <Badge variant="outline" className="text-sm border-white/10 text-neutral-300">
                {activities.length} activités
              </Badge>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 w-4 h-4" />
            <Input
              placeholder="Rechercher une activité..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-surface-elevated border-white/10 text-neutral-100"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48 border-white/10 bg-surface-elevated text-neutral-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-surface-card border border-white/10 text-neutral-100">
              <SelectItem value="ALL">Tous les types</SelectItem>
              <SelectItem value="session">Sessions</SelectItem>
              <SelectItem value="user">Utilisateurs</SelectItem>
              <SelectItem value="subscription">Abonnements</SelectItem>
              <SelectItem value="credit">Crédits</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Activities List */}
        <Card className="bg-surface-card border border-white/10 shadow-premium">
          <CardHeader>
            <CardTitle className="text-white">Activités ({filteredActivities.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredActivities.length > 0 ? (
                filteredActivities.map((activity, index) => (
                  <div key={activity.id || index} className="flex items-start space-x-3 p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex-shrink-0">
                      {getTypeIcon(activity.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {activity.title}
                          </p>
                          <p className="text-xs text-neutral-400 mt-1">
                            {activity.description}
                          </p>
                          <div className="flex items-center space-x-4 mt-2">
                            {activity.studentName && (
                              <span className="text-xs text-neutral-400">
                                Élève: {activity.studentName}
                              </span>
                            )}
                            {activity.coachName && (
                              <span className="text-xs text-neutral-400">
                                Coach: {activity.coachName}
                              </span>
                            )}
                            {activity.subject && (
                              <span className="text-xs text-neutral-400">
                                Sujet: {activity.subject}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <Badge variant={getStatusBadgeVariant(activity.status)}>
                            {activity.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-white/10 text-neutral-300">
                            {getTypeText(activity.type)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/10">
                        <p className="text-xs text-neutral-400">
                          {activity.action} - {new Date(activity.time).toLocaleDateString('fr-FR')} à {new Date(activity.time).toLocaleTimeString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Aucune activité trouvée
                  </h3>
                  <p className="text-neutral-400">
                    {searchTerm ? 'Aucune activité ne correspond à votre recherche.' : 'Aucune activité disponible.'}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6">
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-neutral-200 hover:text-white"
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </Button>
                  <span className="flex items-center px-3 py-2 text-sm text-neutral-300">
                    Page {currentPage} sur {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-white/10 text-neutral-200 hover:text-white"
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
      </main>
    </div>
  );
} 
