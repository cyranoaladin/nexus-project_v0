'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpenCheck } from "lucide-react";
import { BilanCard, BilanCardProps } from "@/components/BilanCard";
import { Loader2 } from "lucide-react";

interface DashboardData {
  student: {
    id: string;
    firstName: string;
  };
  sessions: any[];
  documents: any[];
  bilans: any[];
  bilanPremiumReports: BilanCardProps[];
}

export default function StudentDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchData = async () => {
    setError(null);
    try {
      const response = await fetch('/api/student/dashboard');
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.statusText}`);
      }
      const dashboardData = await response.json();
      setData(dashboardData);
    } catch (error: any) {
      console.error("Failed to fetch dashboard data", error);
      setError(error.message || "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBilan = async () => {
    try {
      const response = await fetch('/api/bilans/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('La création du bilan a échoué');
      }

      const newBilan = await response.json();
      // Use the correct dashboard path
      router.push(`/student/bilan/${newBilan.id}/volet2`);

    } catch (error) {
      console.error(error);
      // Optionally, show an error to the user
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-16 h-16 animate-spin" />
      </div>
    );
  }
  
  if (error) return <p>Erreur: {error}</p>;
  if (!data) return <p>Impossible de charger les données du tableau de bord.</p>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-4xl font-bold mb-4">Dashboard Étudiant</h1>
      <p className="text-lg text-gray-700 mb-6">
        Bienvenue, {data.student.firstName}. Vous pouvez consulter vos bilans, documents et sessions ici.
      </p>

      {/* Section Bilans Premium */}
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-4">Mes Bilans Premium</h2>
        <Card>
          <CardHeader>
            <CardTitle>Rapports de performance</CardTitle>
            <CardDescription>
              Suivez votre progression avec des analyses détaillées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.bilanPremiumReports && data.bilanPremiumReports.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.bilanPremiumReports.map((bilan) => (
                  <BilanCard key={bilan.id} bilan={bilan} />
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                Vous n'avez pas encore de bilan premium.
              </p>
            )}
          </CardContent>
          <CardFooter>
             <Button onClick={handleCreateBilan}>
                <BookOpenCheck className="w-4 h-4 mr-2" />
                Commencer un nouveau bilan
              </Button>
          </CardFooter>
        </Card>
      </div>

    </div>
  );
}
