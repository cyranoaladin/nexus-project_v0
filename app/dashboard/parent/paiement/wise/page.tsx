"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, Check, Copy, Globe, Upload } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface OrderDetails {
  id: string;
  amount: number;
  description: string;
  currency?: string;
}

function WisePaymentContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState("");
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null);
  const [transferReference, setTransferReference] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferProof, setTransferProof] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin");
      return;
    }

    const orderIdParam = searchParams.get('orderId');
    if (orderIdParam) {
      setOrderId(orderIdParam);
      // Simulation de récupération des détails de commande
      setOrderDetails({
        id: orderIdParam,
        amount: 450,
        description: "Abonnement HYBRIDE",
        currency: "TND"
      });
    } else {
      router.push('/dashboard/parent/abonnements');
    }
  }, [session, status, router, searchParams]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTransferProof(file);
    }
  };

  const handleSubmitProof = async () => {
    if (!transferReference || !transferDate || !transferAmount) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('orderId', orderId);
      formData.append('transferReference', transferReference);
      formData.append('transferDate', transferDate);
      formData.append('transferAmount', transferAmount);
      if (transferProof) {
        formData.append('transferProof', transferProof);
      }

      const response = await fetch('/api/payments/wise/confirm', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        router.push('/dashboard/parent/paiement/confirmation');
      } else {
        alert('Erreur lors de l\'envoi de la preuve de virement');
      }
    } catch {
      alert('Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-4"></div>
          <p className="text-neutral-300">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="bg-surface-card/80 shadow-sm border-b border-white/10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/dashboard/parent/paiement">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-white">Virement International Wise</h1>
              <p className="text-sm text-neutral-400">Effectuez votre virement et confirmez</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-neutral-400">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/dashboard/parent/abonnements" className="hover:text-white transition">
                Abonnements
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/dashboard/parent/paiement" className="hover:text-white transition">
                Paiement
              </Link>
            </li>
            <li>/</li>
            <li className="text-neutral-200">Wise</li>
          </ol>
        </nav>
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Coordonnées Wise */}
          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 mr-2 text-brand-primary" />
                Coordonnées de Virement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Montant à virer */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-center">
                  <div className="text-sm text-neutral-300 mb-1">Montant exact à virer</div>
                  <div className="text-3xl font-bold text-brand-accent">
                    {orderDetails.amount} TND
                  </div>
                  <div className="text-sm text-neutral-400 mt-1">
                    {orderDetails.description}
                  </div>
                </div>
              </div>

              {/* Coordonnées bancaires */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-neutral-200">Bénéficiaire</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      value="Nexus Réussite SARL"
                      readOnly
                      className="bg-white/5 border-white/10 text-neutral-100"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("Nexus Réussite SARL", "beneficiary")}
                    >
                      {copied === "beneficiary" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-neutral-200">IBAN</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      value="GB29 NWBK 6016 1331 9268 19"
                      readOnly
                      className="bg-white/5 border-white/10 text-neutral-100 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("GB29 NWBK 6016 1331 9268 19", "iban")}
                    >
                      {copied === "iban" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-neutral-200">Code SWIFT/BIC</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      value="NWBKGB2L"
                      readOnly
                      className="bg-white/5 border-white/10 text-neutral-100 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard("NWBKGB2L", "swift")}
                    >
                      {copied === "swift" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-neutral-200">Référence de virement</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input
                      value={`NEXUS-${orderId.slice(-8).toUpperCase()}`}
                      readOnly
                      className="bg-white/5 border-white/10 text-neutral-100 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(`NEXUS-${orderId.slice(-8).toUpperCase()}`, "reference")}
                    >
                      {copied === "reference" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Instructions importantes */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-300 mt-0.5" />
                  <div className="text-sm text-neutral-300">
                    <div className="font-semibold mb-1">Instructions importantes :</div>
                    <ul className="space-y-1 text-xs">
                      <li>• Utilisez exactement la référence fournie</li>
                      <li>• Le montant doit être exact (frais à votre charge)</li>
                      <li>• Conservez votre reçu de virement</li>
                      <li>• Validation sous 24-48h ouvrées</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation de virement */}
          <Card className="bg-white/5 border border-white/10">
            <CardHeader>
              <CardTitle>Confirmer votre Virement</CardTitle>
              <p className="text-neutral-300 text-sm">
                Une fois le virement effectué, remplissez ce formulaire
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="transferReference">Référence utilisée *</Label>
                <Input
                  id="transferReference"
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder={`NEXUS-${orderId.slice(-8).toUpperCase()}`}
                  className="font-mono"
                />
              </div>

              <div>
                <Label htmlFor="transferDate">Date du virement *</Label>
                <Input
                  id="transferDate"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="transferAmount">Montant viré *</Label>
                <Input
                  id="transferAmount"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder={`${orderDetails.amount} TND`}
                />
              </div>

              <div>
                <Label htmlFor="transferProof">Preuve de virement (optionnel)</Label>
                <div className="mt-1">
                  <input
                    id="transferProof"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-neutral-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-neutral-100 hover:file:bg-white/20"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    PDF, JPG ou PNG - Max 5MB
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Check className="w-5 h-5 text-emerald-300 mt-0.5" />
                  <div className="text-sm text-neutral-300">
                    <div className="font-semibold mb-1">Validation rapide</div>
                    <div>
                      Notre équipe validera votre virement sous 24-48h ouvrées.
                      Vous recevrez un email de confirmation.
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleSubmitProof}
                disabled={isSubmitting || !transferReference || !transferDate || !transferAmount}
                className="w-full h-12"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Confirmer mon Virement
                  </>
                )}
              </Button>

              <p className="text-xs text-neutral-400 text-center">
                En confirmant, vous certifiez avoir effectué le virement avec les informations fournies
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function WisePaymentPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <WisePaymentContent />
    </Suspense>
  );
}
