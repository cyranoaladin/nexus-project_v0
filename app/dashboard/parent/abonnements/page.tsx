"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ARIA_ADDONS, SPECIAL_PACKS, SUBSCRIPTION_PLANS } from "@/lib/constants";
import { ArrowLeft, Brain, Check, CreditCard, Star, Users } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AbonnementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [parentData, setParentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    // Simulation de chargement des données
    setTimeout(() => {
      const mockData = {
        children: [
          {
            id: "1",
            firstName: "Emma",
            lastName: "Martin",
            grade: "Terminale",
            currentSubscription: "HYBRIDE",
            ariaSubjects: ["MATHEMATIQUES"]
          }
        ]
      };
      setParentData(mockData);
      if (mockData.children.length > 0) {
        setSelectedChild(mockData.children[0].id);
      }
      setLoading(false);
    }, 1000);
  }, [session, status, router]);

  const currentChild = parentData?.children.find((child: any) => child.id === selectedChild);

  const handleSubscriptionChange = async (planKey: string) => {
    try {
      const response = await fetch('/api/subscriptions/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: selectedChild,
          newPlan: planKey
        })
      });

      if (response.ok) {
        // Rediriger vers le paiement
        router.push(`/dashboard/parent/paiement?plan=${planKey}&student=${selectedChild}`);
      } else {
        alert('Erreur lors du changement d\'abonnement');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue');
    }
  };

  const handleAriaAddon = async (addonKey: string) => {
    try {
      const response = await fetch('/api/subscriptions/aria-addon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: selectedChild,
          addon: addonKey
        })
      });

      if (response.ok) {
        router.push(`/dashboard/parent/paiement?addon=${addonKey}&student=${selectedChild}`);
      } else {
        alert('Erreur lors de l\'ajout de l\'add-on');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Une erreur est survenue');
    }
  };

  const handleSpecialPack = async (packKey: string) => {
    router.push(`/dashboard/parent/paiement?pack=${packKey}&student=${selectedChild}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/dashboard/parent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-gray-900">Gestion des Abonnements</h1>
              <p className="text-sm text-gray-500">Modifiez les formules et add-ons</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sélecteur d'enfant */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Enfant :</span>
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sélectionner un enfant" />
              </SelectTrigger>
              <SelectContent>
                {parentData?.children.map((child: any) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.firstName} {child.lastName} ({child.grade})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {currentChild && (
          <>
            {/* Abonnement Actuel */}
            <Card className="mb-8 bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-blue-600" />
                  Abonnement Actuel - {currentChild.firstName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-blue-600">
                      {SUBSCRIPTION_PLANS[currentChild.currentSubscription as keyof typeof SUBSCRIPTION_PLANS]?.name}
                    </h3>
                    <p className="text-gray-600">
                      {SUBSCRIPTION_PLANS[currentChild.currentSubscription as keyof typeof SUBSCRIPTION_PLANS]?.price} TND/mois
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      ARIA activé sur : {currentChild.ariaSubjects.join(', ')}
                    </p>
                  </div>
                  <Badge variant="default">Actif</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Changer d'Abonnement */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Changer d'Abonnement</CardTitle>
                <p className="text-gray-600">Modifiez votre formule mensuelle</p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-6">
                  {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
                    <Card
                      key={key}
                      className={`relative ${key === currentChild.currentSubscription
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300'
                        }`}
                    >
                      {'popular' in plan && plan.popular && (
                        <Badge variant="popular" className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <Star className="w-3 h-3 mr-1" />
                          Populaire
                        </Badge>
                      )}

                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        <div className="text-2xl font-bold text-blue-600">
                          {plan.price} TND
                        </div>
                        <p className="text-sm text-gray-600">/mois</p>
                      </CardHeader>

                      <CardContent>
                        <ul className="space-y-2 mb-4">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-600">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {key === currentChild.currentSubscription ? (
                          <Button disabled className="w-full">
                            Abonnement Actuel
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSubscriptionChange(key)}
                            className="w-full"
                            variant={'popular' in plan && plan.popular ? "default" : "outline"}
                          >
                            Changer pour {plan.name}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Add-ons ARIA */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-purple-600" />
                  Add-ons ARIA
                </CardTitle>
                <p className="text-gray-600">Étendez les capacités de votre assistant IA</p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {Object.entries(ARIA_ADDONS).map(([key, addon]) => (
                    <Card key={key} className="border-gray-200">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="font-semibold text-lg">{addon.name}</h4>
                            <p className="text-gray-600 text-sm">{addon.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-bold text-purple-600">
                              +{addon.price} TND
                            </span>
                            <span className="text-gray-600 text-sm block">/mois</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAriaAddon(key)}
                          className="w-full"
                          variant="outline"
                        >
                          Ajouter cet Add-on
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Packs Spécifiques */}
            <Card>
              <CardHeader>
                <CardTitle>Packs Spécifiques</CardTitle>
                <p className="text-gray-600">Accompagnements ciblés (paiement unique)</p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(SPECIAL_PACKS).map(([key, pack]) => (
                    <Card key={key} className="border-gray-200">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">{pack.name}</CardTitle>
                        <div className="text-2xl font-bold text-green-600">
                          {pack.price} TND
                        </div>
                        <p className="text-sm text-gray-600">{pack.description}</p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-1 mb-4">
                          {pack.features.slice(0, 3).map((feature, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <Check className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                              <span className="text-xs text-gray-600">{feature}</span>
                            </li>
                          ))}
                          {pack.features.length > 3 && (
                            <li className="text-xs text-gray-500">
                              +{pack.features.length - 3} autres avantages
                            </li>
                          )}
                        </ul>
                        <Button
                          onClick={() => handleSpecialPack(key)}
                          className="w-full"
                          variant="outline"
                        >
                          Acheter ce Pack
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
