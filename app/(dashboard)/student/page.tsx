"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, LogOut, User, Calendar, BookOpen } from "lucide-react";
import { CreditsSystem } from "@/components/ui/credits-system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AriaChat } from "@/components/ui/aria-chat";
import SessionBooking from "@/components/ui/session-booking";
import { signOut } from "next-auth/react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface DashboardData {
  credits: {
    balance: number;
    transactions: Array<{
      id: string;
      amount: number;
      type: 'DEBIT' | 'CREDIT';
      description: string;
      date: string;
    }>;
  };
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export default function StudentDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push("/auth/signin");
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Using the existing API endpoint for student dashboard data
        const response = await fetch('/api/student/dashboard');

        if (response.ok) {
          const data = await response.json();
          setDashboardData(data);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <User className="w-8 h-8 text-brand-primary" />
              <div>
                <h1 className="font-semibold text-neutral-900">
                  {session?.user.firstName} {session?.user.lastName}
                </h1>
                <p className="text-sm text-neutral-500">Espace Étudiant</p>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-neutral-600 hover:text-neutral-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Credits & Stats */}
          <div className="lg:col-span-1 space-y-6">
            <section>
              <CreditsSystem
                balance={dashboardData?.credits.balance || 0}
                transactions={dashboardData?.credits.transactions || []}
              />
            </section>

            {/* Additional Widgets could go here */}
          </div>

          {/* Right Column: Main Booking Area */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-sm h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-primary" />
                  Mon Planning & Réservations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SessionBooking
                  studentId={session!.user.id}
                  userCredits={dashboardData?.credits.balance || 0}
                  onBookingComplete={(sessionId: string) => {
                    console.log("Session booked:", sessionId);
                    window.location.reload();
                  }}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Resources Tab Section (Optional/Future) */}
        <section className="mt-8">
          <Tabs defaultValue="resources" className="w-full">
            <TabsList className="grid w-full grid-cols-1 lg:w-[200px] mb-4">
              <TabsTrigger value="resources">Mes Ressources</TabsTrigger>
            </TabsList>

            <TabsContent value="resources">
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Accédez ici à vos documents pédagogiques et compte-rendus.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

      </main>

      {/* ARIA Chat Widget */}
      <AriaChat />
    </div>
  );
}
