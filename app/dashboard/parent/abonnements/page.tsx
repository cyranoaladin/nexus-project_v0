"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ARIA_ADDONS, SPECIAL_PACKS, SUBSCRIPTION_PLANS } from "@/lib/constants";
import { ArrowLeft, Brain, Check, CreditCard, Star, Users, AlertCircle, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CorporateFooter } from "@/components/layout/CorporateFooter";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  school: string;
  currentSubscription: string;
  subscriptionStatus: string;
  subscriptionExpiry: string | null;
  creditBalance: number;
  ariaSubjects: string[];
}

type SubscriptionPlan = typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS];
type SelectedPlan = SubscriptionPlan;

export default function AbonnementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [parentData, setParentData] = useState<{ children: Child[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    fetchSubscriptions();
  }, [session, status, router]);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/parent/subscriptions');

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions');
      }

      const data = await response.json();
      setParentData(data);

      if (data.children.length > 0) {
        setSelectedChild(data.children[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const currentChild = parentData?.children.find((child) => child.id === selectedChild);

  const handleSubscriptionRequest = async (plan: SubscriptionPlan) => {
    if (!selectedChild) {
      alert('Veuillez sélectionner un enfant');
      return;
    }

    const requestData = {
      studentId: selectedChild,
      planName: plan.name,
      monthlyPrice: plan.price,
      creditsPerMonth: plan.credits
    };


    setIsRequesting(true);
    try {
      const response = await fetch('/api/parent/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.subscription.message);
        setShowRequestDialog(false);
        fetchSubscriptions(); // Refresh data
      } else {
        const errorData = await response.json();
        alert(`Erreur lors de la demande d'abonnement: ${errorData.error}`);
      }
    } catch {
      alert('Une erreur est survenue');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleAriaAddon = async (addonKey: string) => {
    if (!selectedChild) {
      alert('Veuillez sélectionner un enfant');
      return;
    }

    setIsRequesting(true);
    try {
      const response = await fetch('/api/parent/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: selectedChild,
          planName: `ARIA_${addonKey}`,
          monthlyPrice: ARIA_ADDONS[addonKey as keyof typeof ARIA_ADDONS]?.price || 0,
          creditsPerMonth: 0
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.subscription.message);
        fetchSubscriptions(); // Refresh data
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Erreur lors de l\'ajout de l\'add-on');
      }
    } catch {
      alert('Une erreur est survenue');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSpecialPack = async (packKey: string) => {
    router.push(`/dashboard/parent/paiement?pack=${packKey}&student=${selectedChild}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-300">Chargement des abonnements...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button
            onClick={() => fetchSubscriptions()}
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="bg-surface-card/80 shadow-sm border-b border-white/10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center h-auto sm:h-16 py-3 sm:py-0">
            <Button
              variant="ghost"
              asChild
              className="mb-2 sm:mb-0 sm:mr-4 w-full sm:w-auto justify-start sm:justify-center"
            >
              <Link href="/dashboard/parent">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span className="whitespace-nowrap">Retour au Dashboard</span>
              </Link>
            </Button>
            <div className="w-full sm:w-auto">
              <h1 className="font-semibold text-white text-lg sm:text-xl">Gestion des Abonnements</h1>
              <p className="text-sm text-neutral-400">Modifiez les formules et add-ons</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Sélecteur d'enfant */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center">
              <Users className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              <span className="text-sm font-medium text-neutral-200 ml-2">Enfant :</span>
            </div>
            <Select value={selectedChild} onValueChange={setSelectedChild}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sélectionner un enfant" />
              </SelectTrigger>
              <SelectContent>
                {parentData?.children.map((child) => (
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
            <Card className="mb-6 sm:mb-8 bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-brand-accent" />
                  <span>Abonnement Actuel - {currentChild.firstName}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-brand-accent">
                      {currentChild.currentSubscription !== 'AUCUN'
                        ? currentChild.currentSubscription
                        : 'Aucun abonnement actif'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 sm:mt-0">
                      <p className="text-neutral-300">
                        {currentChild.subscriptionStatus === 'ACTIVE' ? 'Actif' : 'Inactif'}
                      </p>
                      <span className="hidden sm:inline">•</span>
                      <p className="text-sm text-neutral-400">
                        Solde : {currentChild.creditBalance} crédits
                      </p>
                    </div>
                    {currentChild.subscriptionExpiry && (
                      <p className="text-xs text-neutral-400 mt-1">
                        Expire le : {new Date(currentChild.subscriptionExpiry).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <Badge variant={currentChild.subscriptionStatus === 'ACTIVE' ? 'default' : 'outline'}>
                    {currentChild.subscriptionStatus === 'ACTIVE' ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Changer d'Abonnement */}
            <Card className="mb-6 sm:mb-8 bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle>Changer d'Abonnement</CardTitle>
                <p className="text-neutral-300">Modifiez votre formule mensuelle</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => (
                    <Card
                      key={key}
                      className={`relative ${key === currentChild.currentSubscription
                        ? 'border-brand-accent/60 bg-white/10'
                        : 'border-white/10 hover:border-brand-accent/50 bg-white/5'
                        }`}
                    >
                      {'popular' in plan && plan.popular && (
                        <Badge variant="popular" className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                          <Star className="w-3 h-3 mr-1" />
                          Populaire
                        </Badge>
                      )}

                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-base sm:text-lg">{plan.name}</CardTitle>
                        <div className="text-xl sm:text-2xl font-bold text-brand-accent">
                          {plan.price} TND
                        </div>
                        <p className="text-sm text-neutral-400">/mois</p>
                      </CardHeader>

                      <CardContent>
                        <ul className="space-y-1 sm:space-y-2 mb-4">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <Check className="w-3 h-3 sm:w-4 sm:h-4 text-emerald-300 mt-0.5 flex-shrink-0" />
                              <span className="text-xs sm:text-sm text-neutral-300">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {key === currentChild.currentSubscription && currentChild.subscriptionStatus === 'ACTIVE' ? (
                          <Button disabled className="w-full text-sm sm:text-base">
                            Abonnement Actuel
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              setSelectedPlan(SUBSCRIPTION_PLANS[key as keyof typeof SUBSCRIPTION_PLANS]);
                              setShowRequestDialog(true);
                            }}
                            className="w-full text-sm sm:text-base"
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
            <Card className="mb-6 sm:mb-8 bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-violet-300" />
                  Add-ons ARIA
                </CardTitle>
                <p className="text-neutral-300">Étendez les capacités de votre assistant IA</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {Object.entries(ARIA_ADDONS).map(([key, addon]) => (
                    <Card key={key} className="border-white/10 bg-white/5">
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-4 mb-4">
                          <div>
                            <h4 className="font-semibold text-base sm:text-lg">{addon.name}</h4>
                            <p className="text-neutral-300 text-xs sm:text-sm">{addon.description}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg sm:text-xl font-bold text-violet-300">
                              +{addon.price} TND
                            </span>
                            <span className="text-neutral-400 text-xs sm:text-sm block">/mois</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleAriaAddon(key)}
                          className="w-full text-sm sm:text-base"
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
            <Card className="bg-white/5 border border-white/10">
              <CardHeader>
                <CardTitle>Packs Spécifiques</CardTitle>
                <p className="text-neutral-300">Accompagnements ciblés (paiement unique)</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {Object.entries(SPECIAL_PACKS).map(([key, pack]) => (
                    <Card key={key} className="border-white/10 bg-white/5">
                      <CardHeader className="pb-3 sm:pb-4">
                        <CardTitle className="text-base sm:text-lg">{pack.name}</CardTitle>
                        <div className="text-xl sm:text-2xl font-bold text-emerald-300">
                          {pack.price} TND
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-300">{pack.description}</p>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ul className="space-y-1 mb-3 sm:mb-4">
                          {pack.features.slice(0, 3).map((feature, index) => (
                            <li key={index} className="flex items-start space-x-1 sm:space-x-2">
                              <Check className="w-3 h-3 text-emerald-300 mt-0.5 sm:mt-1 flex-shrink-0" />
                              <span className="text-xs text-neutral-300">{feature}</span>
                            </li>
                          ))}
                          {pack.features.length > 3 && (
                            <li className="text-xs text-neutral-400">
                              +{pack.features.length - 3} autres avantages
                            </li>
                          )}
                        </ul>
                        <Button
                          onClick={() => handleSpecialPack(key)}
                          className="w-full text-sm sm:text-base"
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

        {/* Subscription Request Dialog */}
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogContent className="sm:max-w-md bg-surface-card border border-white/10 text-neutral-100">
            <DialogHeader>
              <DialogTitle>Demande d'Abonnement</DialogTitle>
            </DialogHeader>
            {selectedPlan && (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                  <h3 className="font-semibold text-white">{selectedPlan.name}</h3>
                  <p className="text-neutral-300">{selectedPlan.price} TND/mois</p>
                  <p className="text-sm text-neutral-400 mt-2">
                    {selectedPlan.credits} crédits inclus par mois
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-neutral-200">Fonctionnalités incluses :</h4>
                  <ul className="space-y-1">
                    {selectedPlan.features.map((feature: string, index: number) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Check className="w-3 h-3 text-emerald-300" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-lg">
                  <p className="text-sm text-neutral-300">
                    <strong>Note :</strong> Votre demande sera envoyée à l'assistant pour approbation.
                    Vous recevrez une notification une fois approuvée.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button
                    onClick={() => handleSubscriptionRequest(selectedPlan)}
                    className="flex-1"
                    disabled={isRequesting}
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Envoi...
                      </>
                    ) : (
                      'Envoyer la Demande'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRequestDialog(false)}
                    className="flex-1"
                    disabled={isRequesting}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
    <CorporateFooter />  
    </>
  );
}
