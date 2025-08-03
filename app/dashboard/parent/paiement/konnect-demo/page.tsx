"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, CreditCard, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function KonnectDemoContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentId, setPaymentId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    const paymentIdParam = searchParams.get('paymentId');
    if (paymentIdParam) {
      setPaymentId(paymentIdParam);
    } else {
      router.push('/dashboard/parent/abonnements');
    }
  }, [session, status, router, searchParams]);

  const handlePaymentSuccess = async () => {
    setIsProcessing(true);

    try {
      // Simulation du webhook Konnect
      const response = await fetch('/api/webhooks/konnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          payment_id: paymentId,
          status: 'completed',
          amount: 450000, // En millimes
          currency: 'TND'
        })
      });

      if (response.ok) {
        router.push('/dashboard/parent/paiement/confirmation');
      } else {
        alert('Erreur lors de la validation du paiement');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaymentFailure = () => {
    router.push('/dashboard/parent/paiement?error=payment_failed');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/dashboard/parent/paiement">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900">Paiement Konnect</h1>
              <p className="text-sm text-gray-500">Simulation de paiement</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="border-2 border-blue-200">
          <CardHeader className="text-center bg-blue-50">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Simulation Paiement Konnect
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Interface de démonstration pour tester le flux de paiement
            </p>
          </CardHeader>

          <CardContent className="p-8 space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">
                🚧 Mode Démonstration
              </h3>
              <p className="text-yellow-700 text-sm">
                Ceci est une simulation du processus de paiement Konnect.
                En production, vous seriez redirigé vers la vraie interface Konnect.
              </p>
            </div>

            <div className="text-center space-y-4">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-lg text-gray-900 mb-2">
                  Montant à payer
                </h4>
                <div className="text-3xl font-bold text-blue-600">450 TND</div>
                <p className="text-gray-600 text-sm mt-1">Abonnement HYBRIDE</p>
              </div>

              <div className="space-y-3">
                <p className="text-gray-700 font-medium">
                  Choisissez le résultat de votre paiement :
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={handlePaymentSuccess}
                    disabled={isProcessing}
                    className="h-16 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle className="w-6 h-6 mr-2" />
                    <div className="text-left">
                      <div className="font-semibold">Paiement Réussi</div>
                      <div className="text-sm opacity-90">Simuler un succès</div>
                    </div>
                  </Button>

                  <Button
                    onClick={handlePaymentFailure}
                    disabled={isProcessing}
                    variant="outline"
                    className="h-16 border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <X className="w-6 h-6 mr-2" />
                    <div className="text-left">
                      <div className="font-semibold">Paiement Échoué</div>
                      <div className="text-sm opacity-70">Simuler un échec</div>
                    </div>
                  </Button>
                </div>
              </div>

              {isProcessing && (
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  <span>Traitement du paiement...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function KonnectDemoPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <KonnectDemoContent />
    </Suspense>
  );
}
