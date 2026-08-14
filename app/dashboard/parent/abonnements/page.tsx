"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSpecialPackCatalog } from "@/lib/operational-catalog";
import { AnnualParcoursCard } from "@/components/dashboard/parent/AnnualParcoursCard";
import { ArrowLeft, Check, CreditCard, Users, AlertCircle, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import InvoiceDetailsDialog from "../invoice-details-dialog";

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  school: string;
  currentSubscription: string;
  subscriptionStatus: string;
  subscriptionExpiry: string | null;
  subscriptionDetails: {
    planName: string;
    monthlyPrice: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  ariaSubjects: string[];
}

const SPECIAL_PACK_CATALOG = getSpecialPackCatalog();

export default function AbonnementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [parentData, setParentData] = useState<{ children: Child[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <header className="bg-surface-card/80 shadow-sm border-b backdrop-blur">
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
              <h1 className="font-semibold text-lg sm:text-xl">Formules et accompagnements</h1>
              <p className="text-sm text-neutral-400">Les parcours proposés pour vos enfants</p>
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
            <Card className="mb-6 sm:mb-8 bg-white/5">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-brand-accent" />
                  <span>Formule actuelle - {currentChild.firstName}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-brand-accent">
                      {currentChild.currentSubscription !== 'AUCUN'
                        ? currentChild.currentSubscription
                        : 'Aucune formule active'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 sm:mt-0">
                      <p className="text-neutral-300">
                        {currentChild.subscriptionStatus === 'ACTIVE' ? 'Actif' : 'Inactif'}
                      </p>
                    </div>
                    {currentChild.subscriptionExpiry && (
                      <p className="text-xs text-neutral-400 mt-1">
                        Expire le : {new Date(currentChild.subscriptionExpiry).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    {currentChild.subscriptionDetails && (
                      <InvoiceDetailsDialog
                        subscriptionDetails={currentChild.subscriptionDetails}
                        studentName={`${currentChild.firstName} ${currentChild.lastName}`}
                      />
                    )}
                    <Badge variant={currentChild.subscriptionStatus === 'ACTIVE' ? 'default' : 'outline'} className="justify-center">
                      {currentChild.subscriptionStatus === 'ACTIVE' ? 'Actif' : 'Inactif'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/*
              Parcours annuels — même catalogue que le site public.
              Remplace la vente d'abonnements mensuels et d'add-ons ARIA, retirée
              tant que la plateforme ne délivre aucune matière (lib/commerce/sale-suspension.ts).
              L'inscription passe par le chemin réel : conseil, validation pédagogique,
              puis paiement au centre ou par virement.
            */}
            <AnnualParcoursCard childFirstName={currentChild.firstName} />

            {/* Packs Spécifiques */}
            <Card className="bg-white/5">
              <CardHeader>
                <CardTitle>Packs Spécifiques</CardTitle>
                <p className="text-neutral-300">Accompagnements ciblés (paiement unique)</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {Object.entries(SPECIAL_PACK_CATALOG).map(([key, pack]) => (
                    <Card key={key} className="bg-white/5">
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
      </main>
    </div>
    <CorporateFooter />
    </>
  );
}
