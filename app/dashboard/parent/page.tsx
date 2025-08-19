"use client";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SessionBooking from "@/components/ui/session-booking";
import { AlertCircle, Calendar, CreditCard, Loader2, LogOut, TrendingUp, User, Users } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AddChildDialog from "./add-child-dialog";
import { AriaAddonDialog } from "./aria-addon-dialog";
import CreditPurchaseDialog from "./credit-purchase-dialog";
import InvoiceDetailsDialog from "./invoice-details-dialog";
import SubscriptionChangeDialog from "./subscription-change-dialog";

interface Session {
  id: string;
  subject: string;
  scheduledAt: string;
  coachName: string;
  type: 'COURS_ONLINE' | 'PRESENTIEL';
}

interface SubscriptionDetails {
  planName: string;
  monthlyPrice: number;
  endDate: string;
  status: string;
  startDate: string;
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  credits: number;
  subscription: string;
  progress: number;
  nextSession?: {
    subject: string;
    scheduledAt: string;
  };
  sessions: Session[];
  subjectProgress: Record<string, number>;
  subscriptionDetails?: SubscriptionDetails;
}

interface ParentDashboardData {
  parent: any;
  children: Child[];
}

export default function DashboardParent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard');
  const [showBookingDialog, setShowBookingDialog] = useState(false);

  const refreshDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/parent/dashboard');

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setData(data);

      if (data.children.length > 0 && !selectedChild) {
        setSelectedChild(data.children[0].id);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    refreshDashboardData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de votre espace...</p>
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

  const currentChild = data?.children.find((child) => child.id === selectedChild);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 sm:py-0 sm:h-16 gap-3 sm:gap-0">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <Users className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
                <div>
                  <h1 className="font-semibold text-gray-900 text-sm sm:text-base">
                    {session?.user.firstName} {session?.user.lastName}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500">Espace Parent</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg ml-4">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${activeTab === 'dashboard'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Tableau de Bord
                </button>
                <button
                  onClick={() => setActiveTab('booking')}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${activeTab === 'booking'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Réserver Session
                </button>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600 hover:text-gray-900 text-xs sm:text-sm"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
              <span className="sm:hidden">Déco</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {activeTab === 'dashboard' && (
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
            <Card className="mb-6 sm:mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center flex-wrap gap-2">
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  <span className="text-lg sm:text-xl">
                    {currentChild?.firstName} {currentChild?.lastName}
                  </span>
                  <Badge variant="outline" className="text-xs sm:text-sm">
                    {currentChild?.grade}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center space-y-1">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">
                      {currentChild?.credits ?? 0}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">Crédits disponibles</p>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-xl sm:text-2xl font-bold text-green-600">
                      {currentChild?.subscription === 'AUCUN' ? 'Aucune' : currentChild?.subscription}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">Formule actuelle</p>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-xl sm:text-2xl font-bold text-purple-600">
                      {Number(currentChild?.progress ?? 0).toFixed(0)}%
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">Progression</p>
                  </div>
                  <div className="text-center space-y-1">
                    <div className="text-xs sm:text-sm font-medium text-gray-900">
                      {currentChild?.nextSession ?
                        `${currentChild?.nextSession.subject} - ${new Date(currentChild?.nextSession.scheduledAt).toLocaleDateString('fr-FR')}` :
                        'Aucune session'
                      }
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">Prochaine session</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-6 sm:mb-8">
              {/* Agenda de l'Enfant */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600" />
                    <span className="text-base sm:text-lg">Agenda de {currentChild?.firstName}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    {currentChild?.sessions && currentChild?.sessions.length > 0 ? (
                      currentChild?.sessions.map((session: Session) => (
                        <div key={session.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-blue-50 rounded-lg gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm sm:text-base">{session.subject}</p>
                            <p className="text-xs sm:text-sm text-gray-600">
                              {new Date(session.scheduledAt).toLocaleDateString('fr-FR')} à {new Date(session.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-500">Coach: {session.coachName}</p>
                          </div>
                          <Badge variant={session.type === 'COURS_ONLINE' ? 'default' : 'outline'} className="text-xs">
                            {session.type === 'COURS_ONLINE' ? 'En ligne' : 'Présentiel'}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 sm:py-8">
                        <p className="text-gray-500 text-sm sm:text-base">Aucune session programmée</p>
                        <Button variant="outline" className="mt-2 text-xs sm:text-sm">
                          Réserver une Session
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Progression */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
                    <span className="text-base sm:text-lg">Progression par Matière</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 sm:space-y-4">
                    {currentChild?.subjectProgress && Object.keys(currentChild.subjectProgress).length > 0 ? (
                      Object.entries(currentChild.subjectProgress).map(([subject, progress]: [string, number]) => (
                        <div key={subject}>
                          <div className="flex justify-between text-xs sm:text-sm mb-1">
                            <span>{subject}</span>
                            <span>{progress.toFixed(0)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: progress > 80 ? '#10B981' : progress > 60 ? '#3B82F6' : progress > 40 ? '#F59E0B' : '#EF4444'
                              }}
                            ></div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">Aucune progression disponible</p>
                        <p className="text-xs text-gray-400 mt-1">Les données apparaîtront après les premières sessions</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Section Abonnement et Facturation */}
            <Card className="mb-6 sm:mb-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-green-600" />
                  <span className="text-base sm:text-lg">Abonnement et Facturation</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  {/* Abonnement Actuel */}
                  <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Formule Actuelle</h3>
                    <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">
                      {currentChild?.subscriptionDetails?.planName || "Aucune formule"}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3">
                      {currentChild?.subscriptionDetails?.monthlyPrice || 0} TND/mois
                    </p>
                    <SubscriptionChangeDialog
                      studentId={currentChild?.id ?? ''}
                      studentName={`${currentChild?.firstName} ${currentChild?.lastName}`}
                      currentPlan={currentChild?.subscriptionDetails?.planName || currentChild?.subscription || 'AUCUN'}
                      onRequestComplete={refreshDashboardData}
                    />
                  </div>

                  {/* Prochaine Facturation */}
                  <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Prochaine Facturation</h3>
                    <div className="text-xl sm:text-2xl font-bold text-green-600 mb-1">
                      {currentChild?.subscriptionDetails?.endDate ?
                        new Date(currentChild?.subscriptionDetails.endDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) :
                        'N/A'
                      }
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 mb-3">
                      {currentChild?.subscriptionDetails?.monthlyPrice || 0} TND
                    </p>
                    <InvoiceDetailsDialog
                      subscriptionDetails={currentChild?.subscriptionDetails || null}
                      studentName={`${currentChild?.firstName} ${currentChild?.lastName}`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">Actions</h3>
                    <div className="space-y-2">
                      <CreditPurchaseDialog
                        studentId={currentChild?.id ?? ''}
                        studentName={`${currentChild?.firstName ?? ''} ${currentChild?.lastName ?? ''}`}
                        onPurchaseComplete={refreshDashboardData}
                      />
                      <AriaAddonDialog
                        studentId={currentChild?.id ?? ''}
                        studentName={`${currentChild?.firstName} ${currentChild?.lastName}`}
                        onSuccess={refreshDashboardData}
                      />
                    </div>
                  </div>
                </div>

                {/* Note importante */}
                <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-yellow-800">
                    <strong>Note :</strong> Les demandes d'achat de crédits sont envoyées à l'assistant pour approbation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'booking' && currentChild && (
          <SessionBooking
            studentId={currentChild?.id}
            parentId={session?.user?.id}
            userCredits={currentChild?.credits}
            onBookingComplete={() => {
              // Re-fetch data to update credits, etc.
              refreshDashboardData();
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
