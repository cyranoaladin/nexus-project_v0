"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ARIA_ADDONS, SPECIAL_PACKS, SUBSCRIPTION_PLANS } from "@/lib/constants";
import { ArrowLeft, Check, Clock, Copy, CreditCard, Landmark } from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

interface OrderDetails {
  type: "subscription" | "addon" | "pack";
  key: string;
  name: string;
  price: number;
  description: string;
  recurring: boolean;
  studentId?: string | null;
}

const IBAN = "TN59 25 079 000 0001569084 04";

function PaiementContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [virementModalOpen, setVirementModalOpen] = useState(false);
  const [confirmingVirement, setConfirmingVirement] = useState(false);
  const [hasPendingPayment, setHasPendingPayment] = useState(false);
  const [pendingCheckDone, setPendingCheckDone] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    // Récupérer les détails de la commande depuis les paramètres URL
    const plan = searchParams.get('plan');
    const addon = searchParams.get('addon');
    const pack = searchParams.get('pack');
    const student = searchParams.get('student');

    let details: OrderDetails | null = null;

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

      // Check for existing PENDING payment (anti-double)
      fetch(`/api/payments/check-pending?description=${encodeURIComponent(details.description)}&amount=${details.price}`)
        .then((res) => res.json())
        .then((data) => { setHasPendingPayment(!!data.hasPending); })
        .catch(() => {})
        .finally(() => setPendingCheckDone(true));
    }
    // No redirect — show default payment overview when no params
  }, [session, status, router, searchParams]);

  const handleCopyIban = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(IBAN);
      toast.success("IBAN copié dans le presse-papier");
    } catch {
      toast.error("Impossible de copier l'IBAN");
    }
  }, []);

  const handleConfirmVirement = useCallback(async () => {
    if (!orderDetails) return;
    setConfirmingVirement(true);

    try {
      const response = await fetch('/api/payments/bank-transfer/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: orderDetails.type,
          key: orderDetails.key,
          studentId: orderDetails.studentId,
          amount: orderDetails.price,
          description: orderDetails.description,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        if (result.alreadyExists) {
          toast.info("Un virement est déjà en attente de validation pour cette commande.");
        } else {
          toast.success("Votre déclaration de virement a été transmise. Elle sera validée sous 24/48h.");
        }
        setVirementModalOpen(false);
        router.refresh();
        router.push('/dashboard/parent/abonnements');
      } else {
        toast.error(result.error || "Erreur lors de l'enregistrement du virement.");
      }
    } catch {
      toast.error("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setConfirmingVirement(false);
    }
  }, [orderDetails, router]);

  if (status === "loading") {
    return <PaiementPageLoading />;
  }

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-transparent">
        <main className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-white mb-6">Paiements</h1>
          <div className="rounded-xl border border-white/10 bg-surface-card p-8 text-center">
            <Landmark className="w-10 h-10 mx-auto mb-4 text-brand-accent" />
            <h2 className="text-lg font-semibold text-white mb-2">Aucune commande en cours</h2>
            <p className="text-neutral-400 mb-6 max-w-md mx-auto">
              Pour effectuer un paiement, choisissez d'abord une formule ou un pack depuis la page Abonnements.
            </p>
            <Link
              href="/dashboard/parent/abonnements"
              className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-6 py-3 text-sm font-bold text-black transition hover:bg-brand-accent-dark"
            >
              <CreditCard className="w-4 h-4" />
              Voir les Abonnements
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-neutral-400">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/dashboard/parent/abonnements" className="hover:text-white transition">
                Abonnements
              </Link>
            </li>
            <li>/</li>
            <li className="text-neutral-200">Paiement</li>
          </ol>
        </nav>
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/dashboard/parent/abonnements"
            className="flex items-center text-neutral-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Retour
          </Link>
          <h1 className="text-2xl font-bold text-white">
            Finaliser votre commande
          </h1>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Résumé de commande */}
          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle>Résumé de la commande</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{orderDetails.name}</h3>
                  <p className="text-sm text-neutral-300">{orderDetails.description}</p>
                  {orderDetails.recurring && (
                    <Badge variant="outline" className="mt-2 border-white/10 bg-white/5 text-neutral-200">
                      Abonnement mensuel
                    </Badge>
                  )}
                </div>
                <span className="font-semibold">{orderDetails.price} TND</span>
              </div>

              <div className="border-t border-white/10 pt-4">
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
          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle>Méthode de Paiement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bandeau anti-double paiement */}
              {pendingCheckDone && hasPendingPayment && (
                <div className="p-4 border border-blue-500/30 rounded-lg bg-blue-500/10">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-slate-200">
                        Votre déclaration de virement est en cours d&apos;analyse par notre équipe.
                      </p>
                      <p className="text-sm text-blue-200/80 mt-1">
                        Merci de patienter. Vous serez notifié dès que votre paiement sera validé (sous 24-48h).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Carte Bancaire — désactivée */}
              <div className="p-4 border border-white/10 rounded-lg bg-white/5 opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-neutral-400" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-400">Paiement par Carte Bancaire</span>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded-full ml-2">
                        Bientôt disponible
                      </span>
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">
                      ClicToPay — Banque Zitouna (en cours de configuration)
                    </p>
                  </div>
                </div>
              </div>

              {/* Virement Bancaire — actif (désactivé si PENDING existe) */}
              <button
                type="button"
                onClick={() => setVirementModalOpen(true)}
                disabled={hasPendingPayment}
                className={`w-full text-left p-4 border rounded-lg transition-colors ${
                  hasPendingPayment
                    ? 'border-white/10 bg-white/5 opacity-50 cursor-not-allowed'
                    : 'border-brand-primary/40 bg-brand-primary/5 hover:bg-brand-primary/10 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Landmark className={`w-5 h-5 ${hasPendingPayment ? 'text-neutral-400' : 'text-brand-primary'}`} />
                  <div className="flex-1">
                    <span className={`font-medium ${hasPendingPayment ? 'text-neutral-400' : 'text-white'}`}>
                      Paiement par virement bancaire
                    </span>
                    <p className="text-sm text-neutral-300 mt-1">
                      Virement sur le compte Banque Zitouna
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Check className={`w-4 h-4 ${hasPendingPayment ? 'text-neutral-500' : 'text-brand-primary'}`} />
                      <span className={`text-sm ${hasPendingPayment ? 'text-neutral-500' : 'text-brand-primary'}`}>
                        Validation sous 24-48h
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              <p className="text-xs text-neutral-400 text-center">
                En procédant au paiement, vous acceptez nos{' '}
                <Link href="/conditions" className="text-brand-primary hover:underline">
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
            <h2 className="text-3xl font-bold text-white mb-6">
              Notre engagement Qualité
            </h2>

            <div className="bg-white/5 rounded-xl shadow-premium p-8 border border-white/10">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div className="space-y-3">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-brand-primary" />
                  </div>
                  <h3 className="font-semibold text-white">Paiement Sécurisé</h3>
                  <p className="text-sm text-neutral-300">
                    Toutes vos transactions sont protégées par un cryptage SSL de niveau bancaire
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                    <Landmark className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-white">Support 24/7</h3>
                  <p className="text-sm text-neutral-300">
                    Notre équipe est disponible à tout moment pour vous accompagner
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                    <CreditCard className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-white">Satisfaction Garantie</h3>
                  <p className="text-sm text-neutral-300">
                    Remboursement intégral si vous n&apos;êtes pas satisfait sous 14 jours
                  </p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <p className="text-center text-neutral-200 font-medium">
                  Plus de <span className="text-brand-primary font-bold">10,000 familles</span> nous font confiance
                </p>
                <p className="text-center text-sm text-neutral-400 mt-2">
                  Rejoignez notre communauté d&apos;excellence éducative
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modale Virement Bancaire */}
      <Dialog open={virementModalOpen} onOpenChange={setVirementModalOpen}>
        <DialogContent size="lg" className="bg-neutral-900 border-white/10 text-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-white flex items-center gap-2">
              <Landmark className="w-5 h-5 text-brand-primary" />
              Coordonnées Bancaires
            </DialogTitle>
            <DialogDescription className="text-neutral-300">
              Veuillez effectuer votre virement sur le compte suivant.{' '}
              <strong className="text-blue-200">Important : Indiquez le nom et prénom de l&apos;élève dans le motif du virement.</strong>
            </DialogDescription>
          </DialogHeader>

          {/* Montant */}
          <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-4 text-center">
            <p className="text-sm text-neutral-300">Montant à virer</p>
            <p className="text-3xl font-bold text-brand-primary">{orderDetails?.price} TND</p>
            <p className="text-sm text-neutral-400 mt-1">{orderDetails?.description}</p>
          </div>

          {/* Coordonnées bancaires */}
          <div className="bg-neutral-800/50 border border-white/10 rounded-lg p-5 space-y-3 select-text">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wider">Bénéficiaire</p>
                <p className="font-semibold text-white mt-0.5">STE M&amp;M ACADEMY SUARL</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Banque</p>
              <p className="font-semibold text-white mt-0.5">Banque Zitouna</p>
            </div>

            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Compte</p>
              <p className="font-mono text-white mt-0.5">25 079 000 0001569084 04</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 uppercase tracking-wider">IBAN</p>
                <p className="font-mono text-white mt-0.5">{IBAN}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyIban}
                className="border-white/20 text-neutral-200 hover:text-white hover:bg-white/10 shrink-0 ml-3"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copier l&apos;IBAN
              </Button>
            </div>

            <div>
              <p className="text-xs text-neutral-400 uppercase tracking-wider">SWIFT</p>
              <p className="font-mono text-white mt-0.5">BZITTNTTXXX</p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-col gap-3">
            <Button
              onClick={handleConfirmVirement}
              disabled={confirmingVirement}
              className="w-full"
              size="lg"
            >
              {confirmingVirement ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  J&apos;ai effectué le virement
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setVirementModalOpen(false)}
              className="w-full text-neutral-400 hover:text-white"
            >
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaiementPageLoading() {
  return (
    <div className="min-h-screen bg-transparent">
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-white/10 rounded w-1/3 mb-6"></div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-lg border border-white/10">
                <div className="h-6 bg-white/10 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-white/10 rounded w-full"></div>
                  <div className="h-4 bg-white/10 rounded w-3/4"></div>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white/5 p-6 rounded-lg border border-white/10">
                <div className="h-6 bg-white/10 rounded w-1/2 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-white/10 rounded w-full"></div>
                  <div className="h-4 bg-white/10 rounded w-2/3"></div>
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
