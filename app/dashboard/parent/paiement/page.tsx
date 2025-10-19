"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ARIA_ADDONS, SPECIAL_PACKS, SUBSCRIPTION_PLANS } from "@/lib/constants";
import { ArrowLeft, Check, CreditCard, Globe, MapPin } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function PaiementContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [paymentMethod, setPaymentMethod] = useState("konnect");
  const [loading, setLoading] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    // Init CSRF token (double submit cookie)
    fetch('/api/security/csrf').then(async (r) => {
      try {
        const j = await r.json();
        setCsrfToken(j?.token || null);
      } catch {}
    }).catch(() => {});

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    // Récupérer les détails de la commande depuis les paramètres URL
    const plan = searchParams.get('plan');
    const addon = searchParams.get('addon');
    const pack = searchParams.get('pack');
    const student = searchParams.get('student');

    let details = null;

    if (plan && SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]) {
      const planData = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS];
      details = {
        type: 'subscription',
        key: plan,
        name: planData.name,
        price: planData.price,
        description: `Abonnement mensuel ${planData.name}`,
        recurring: true
      };
    } else if (addon && ARIA_ADDONS[addon as keyof typeof ARIA_ADDONS]) {
      const addonData = ARIA_ADDONS[addon as keyof typeof ARIA_ADDONS];
      details = {
        type: 'addon',
        key: addon,
        name: addonData.name,
        price: addonData.price,
        description: addonData.description,
        recurring: true
      };
    } else if (pack && SPECIAL_PACKS[pack as keyof typeof SPECIAL_PACKS]) {
      const packData = SPECIAL_PACKS[pack as keyof typeof SPECIAL_PACKS];
      details = {
        type: 'pack',
        key: pack,
        name: packData.name,
        price: packData.price,
        description: packData.description,
        recurring: false
      };
    }

    if (details) {
      setOrderDetails({ ...details, studentId: student });
    } else {
      router.push('/dashboard/parent/abonnements');
    }
  }, [session, status, router, searchParams]);

  const handlePayment = async () => {
    if (!orderDetails) return;

    setLoading(true);

    try {
      if (paymentMethod === 'konnect') {
        // Paiement Konnect (Tunisie)
        const response = await fetch('/api/payments/konnect', {
          method: 'POST',
          headers: {
'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
          },
          body: JSON.stringify({
            type: orderDetails.type,
            key: orderDetails.key,
            studentId: orderDetails.studentId,
            amount: orderDetails.price,
            description: orderDetails.description
          })
        });

        const result = await response.json();

        if (result.payUrl) {
          // Rediriger vers la page de paiement Konnect
          window.location.href = result.payUrl;
        } else {
          throw new Error(result.error || 'Erreur lors de la création du paiement');
        }
      }
    } catch (error) {
      console.error('Erreur de paiement:', error);
      alert('Une erreur est survenue lors du traitement du paiement. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !orderDetails) {
    return <PaiementPageLoading />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/parent/abonnements"
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Retour
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Finaliser votre commande
          </h1>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Résumé de commande */}
          <Card>
            <CardHeader>
              <CardTitle>Résumé de la commande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{orderDetails.name}</h3>
                  <p className="text-sm text-gray-600">{orderDetails.description}</p>
                  {orderDetails.recurring && (
                    <Badge variant="outline" className="mt-2">
                      Abonnement mensuel
                    </Badge>
                  )}
                </div>
                <span className="font-semibold">{orderDetails.price} TND</span>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total à payer</span>
                  <span className="text-xl font-bold">
                    {orderDetails.price} TND
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Méthodes de paiement */}
          <Card>
            <CardHeader>
              <CardTitle>Méthode de Paiement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                {/* Konnect (Tunisie) */}
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <RadioGroupItem value="konnect" id="konnect" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="konnect" className="flex items-center gap-2 font-medium cursor-pointer">
                      <MapPin className="w-4 h-4" />
                      Konnect (Tunisie)
                    </Label>
                    <p className="text-sm text-gray-600 mt-1">
                      Paiement sécurisé par carte bancaire tunisienne
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-green-600">Instantané</span>
                    </div>
                  </div>
                </div>

              </RadioGroup>

              <Button
                onClick={handlePayment}
                disabled={loading || !orderDetails}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Traitement...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Procéder au Paiement
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                En cliquant sur "Procéder au Paiement", vous acceptez nos{' '}
                <Link href="/conditions" className="text-blue-600 hover:underline">
                  conditions générales de vente
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section Notre engagement Qualité */}
        <div className="mt-16 text-center">
          {/* Logo centré */}
          <div className="flex justify-center mb-8">
            <Image
              src="/images/logo_slogan_nexus_x3.png"
              alt="Nexus Réussite - Logo avec slogan"
              width={300}
              height={120}
              className="h-auto"
              priority
            />
          </div>

          {/* Section Notre engagement Qualité centrée */}
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Notre engagement Qualité
            </h2>

            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Paiement Sécurisé</h3>
                  <p className="text-sm text-gray-600">
                    Toutes vos transactions sont protégées par un cryptage SSL de niveau bancaire
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <Globe className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Support 24/7</h3>
                  <p className="text-sm text-gray-600">
                    Notre équipe est disponible à tout moment pour vous accompagner
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                    <CreditCard className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Satisfaction Garantie</h3>
                  <p className="text-sm text-gray-600">
                    Remboursement intégral si vous n'êtes pas satisfait sous 14 jours
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-center text-gray-700 font-medium">
                  🏆 Plus de <span className="text-blue-600 font-bold">10,000 familles</span> nous font confiance
                </p>
                <p className="text-center text-sm text-gray-500 mt-2">
                  Rejoignez notre communauté d'excellence éducative
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function PaiementPageLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-full"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PaiementPage() {
  return (
    <Suspense fallback={<PaiementPageLoading />}>
      <PaiementContent />
    </Suspense>
  );
}
