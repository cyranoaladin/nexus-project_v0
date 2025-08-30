'use client';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { Footer } from '@/components/layout/footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import SessionBooking from '@/components/ui/session-booking';
import {
  AlertCircle,
  Calendar,
  CreditCard,
  Loader2,
  LogOut,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import AddChildDialog from './add-child-dialog';
import { AriaAddonDialog } from './aria-addon-dialog';
import CreditPurchaseDialog from './credit-purchase-dialog';
import InvoiceDetailsDialog from './invoice-details-dialog';
import SubscriptionChangeDialog from './subscription-change-dialog';
import { BilanCard } from '@/components/BilanCard';
import { toast } from "sonner";


interface Session {
  id: string;
  subject: string;
  scheduledAt: string;
  coachName: string;
  type: 'COURS_ONLINE' | 'PRESENTIEL';
}

interface Bilan {
  id: string;
  subject: string;
  createdAt: string;
}

interface SubscriptionDetails {
  planName: string;
  credits: number;
  endDate: string;
}

interface BilanPremiumReport {
  id: string;
  variant: 'PARENT' | 'ELEVE';
  status: 'PENDING' | 'GENERATING' | 'COMPILING' | 'READY' | 'FAILED';
  createdAt: string;
  score?: number;
}


interface Child {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  sessions: Session[];
  subjectProgress: Record<string, number>;
  bilans: Bilan[];
  subscriptionDetails?: SubscriptionDetails;
  bilanPremiumReports: BilanPremiumReport[];
}

interface ParentDashboardData {
  parent: any;
  children: Child[];
}


function DashboardParent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedChild, setSelectedChild] = useState<string>('');
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard');
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [openPurchaseDialog, setOpenPurchaseDialog] = useState(false);
  const allowBypass = process.env.NEXT_PUBLIC_E2E === '1' || process.env.NODE_ENV === 'development';

  const refreshDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/parent/dashboard');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setData(data);
      if (data?.children?.length > 0 && !selectedChild) {
        setSelectedChild(data.children[0].id);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [selectedChild]);

  // Ouvrir automatiquement la modale d'achat si query ?open=purchase-credits
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('open') === 'purchase-credits') {
        setOpenPurchaseDialog(true);
      }
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'PARENT') {
      if (!allowBypass) {
        router.push('/auth/signin');
        return;
      }
    }

    refreshDashboardData();
  }, [session, status, router, allowBypass, refreshDashboardData]);
  const isLoading = status === 'loading' || loading;
  const hasError = Boolean(error);

  const currentChild = data?.children.find((c) => c.id === selectedChild);

  const handleGenerateBilan = async (variant: 'PARENT' | 'ELEVE') => {
    if (!currentChild) return;
    
    toast.info("Lancement de la création du bilan...");

    try {
      const response = await fetch('/api/bilans/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: currentChild.id,
          variant: variant.toUpperCase(),
        }),
      });

      if (!response.ok) {
        throw new Error('La création du bilan a échoué.');
      }

      const { bilan } = await response.json();
      toast.success("Bilan créé. Vous pouvez maintenant compléter le volet 2.");
      
      // Redirect to Volet 2 form
      router.push(`/parent/bilan/${bilan.id}/volet2`);
      
      // Optionally refresh data in the background
      refreshDashboardData();

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue";
        toast.error(errorMessage);
        console.error(error);
    }
  };


  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Espace Parent</h1>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            <p className="ml-4 text-lg text-gray-600">Chargement des données...</p>
          </div>
        )}

        {hasError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 mr-3" />
            <div>
              <p className="font-bold">Erreur</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {!isLoading && !hasError && (
          <>
            {/* Welcome Section avec Sélecteur d'Enfants */}
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                    Tableau de Bord Parental 👨‍👩‍👧‍👦
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600">
                    Suivez les progrès et gérez l'accompagnement de vos enfants.
                  </p>
                </div>

                {/* Sélecteur Multi-Enfants */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700">Enfant :</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select value={selectedChild} onValueChange={setSelectedChild}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Sélectionner un enfant" />
                      </SelectTrigger>
                      <SelectContent>
                        {data?.children.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.firstName} {child.lastName} - {child.grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <AddChildDialog onChildAdded={refreshDashboardData} />
                  </div>
                </div>
              </div>
            </div>

            {/* Informations Enfant Sélectionné */}
            {currentChild ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                {/* Colonne Principale */}
                <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                  
                  {/* Rapports de Bilan Premium */}
                  {currentChild.bilanPremiumReports && currentChild.bilanPremiumReports.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-purple-600" />
                          <span className="text-base sm:text-lg">Rapports de Bilan Premium</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                            {currentChild.bilanPremiumReports.map((bilan) => (
                                <BilanCard key={bilan.id} bilan={bilan} />
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Prochaines sessions */}
                  <Card>
                  <CardHeader>
                      <CardTitle className="flex items-center">
                          <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
                          <span className="text-base sm:text-lg">Prochaines Sessions</span>
                      </CardTitle>
                      </CardHeader>
                      <CardContent>
                      {currentChild.sessions?.length > 0 ? (
                          <ul className="space-y-3">
                          {currentChild.sessions.map((session) => (
                              <li key={session.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                              <div>
                                  <p className="font-semibold">{session.subject}</p>
                                  <p className="text-sm text-gray-500">
                                  {new Date(session.scheduledAt).toLocaleString('fr-FR', {
                                      dateStyle: 'long',
                                      timeStyle: 'short',
                                  })}
                                  </p>
                              </div>
                              <Badge variant={session.type === 'COURS_ONLINE' ? 'default' : 'secondary'}>
                                  {session.type === 'COURS_ONLINE' ? 'En ligne' : 'Présentiel'}
                              </Badge>
                              </li>
                          ))}
                          </ul>
                      ) : (
                          <p className="text-gray-500 text-sm">Aucune session programmée.</p>
                      )}
                      </CardContent>
                  </Card>
                </div>

                {/* Colonne Latérale */}
                <div className="space-y-6 sm:space-y-8">
                  {/* Abonnement et Crédits */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
                        <span className="text-base sm:text-lg">Abonnement & Facturation</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {currentChild.subscriptionDetails ? (
                        <>
                          <div>
                            <p className="font-semibold">{currentChild.subscriptionDetails.planName}</p>
                            <p className="text-sm text-gray-500">
                              Expire le {new Date(currentChild.subscriptionDetails.endDate).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <span className="font-medium text-green-800">Crédits restants</span>
                            <span className="text-2xl font-bold text-green-600">
                              {currentChild.subscriptionDetails.credits}
                            </span>
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-sm">Aucun abonnement actif.</p>
                      )}
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-2">
                        <Button className="w-full" onClick={() => setOpenPurchaseDialog(true)}>
                            Acheter des crédits
                        </Button>
                        <InvoiceDetailsDialog />
                    </CardFooter>
                  </Card>
                  
                  {/* Action Bilan Premium */}
                  <Card className="bg-purple-50 border-purple-200">
                      <CardHeader>
                          <CardTitle className="text-purple-800 text-base sm:text-lg">Nouveau Bilan Premium</CardTitle>
                      </CardHeader>
                      <CardContent>
                          <p className="text-sm text-purple-700 mb-4">
                              Générez un rapport détaillé pour analyser les points forts et les axes d'amélioration.
                          </p>
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2">
                          <Button className="w-full bg-purple-600 hover:bg-purple-700" onClick={() => handleGenerateBilan('PARENT')}>
                              Générer (Vue Parent)
                          </Button>
                           <Button className="w-full" variant="outline" onClick={() => handleGenerateBilan('ELEVE')}>
                              Générer (Vue Élève)
                          </Button>
                      </CardFooter>
                  </Card>

                </div>
              </div>
            ) : (
              <div className="text-center py-16">
                <Users className="w-16 h-16 mx-auto text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Aucun enfant sélectionné
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Veuillez sélectionner un enfant pour voir ses informations ou en ajouter un nouveau.
                </p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
      {currentChild && (
          <CreditPurchaseDialog
            open={openPurchaseDialog}
            onOpenChange={setOpenPurchaseDialog}
            childId={currentChild.id}
            onPurchaseSuccess={refreshDashboardData}
          />
      )}
    </div>
  );
}

export default DashboardParent;

