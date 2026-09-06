"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ManualParentWhatsAppHelp } from '@/components/auth/ManualParentWhatsAppHelp';
import { useState } from "react";
import { z } from "zod";
import { normalizeParentPhone } from "@/lib/contact/parent-phone";
// import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";
import Link from "next/link";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [manualDelivery, setManualDelivery] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const identifier = email.trim();
    const isEmail = identifier.includes("@");
    try {
      if (isEmail) z.string().email().parse(identifier);
      else normalizeParentPhone(identifier);
    } catch {
      setError("Saisissez un numéro WhatsApp ou une adresse email valide.");
      return;
    }
    setIsLoading(true);

    try {
      const response = await fetch(isEmail ? "/api/auth/reset-password" : "/api/auth/parent-phone/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEmail ? { email: identifier } : { identifier }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setManualDelivery(data.deliveryMode === 'MANUAL');
        setIsSuccess(true);
      } else {
        setError(data.error || "Impossible de traiter la demande pour le moment.");
      }
    } catch {
      setError("Une erreur réseau est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-lux-ink text-lux-ivory">
        <CorporateNavbar />

        <main id="main-content" tabIndex={-1} className="py-12 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="font-fraunces text-2xl font-light text-lux-ivory mb-4">
                Demande prise en compte
              </h1>
              {manualDelivery ? <ManualParentWhatsAppHelp /> : <p className="text-lux-on-dark-muted">
                Si votre identifiant correspond à un accès récupérable, un lien personnel sera envoyé sur votre canal vérifié.
              </p>}
            </div>

            <Card
              className="border border-lux-line/40 bg-white/5"
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="bg-lux-gold/10 border border-lux-gold/30 rounded-lg p-4">
                    <h2 className="font-semibold text-lux-gold mb-2">
                      Consultez votre canal de contact
                    </h2>
                    <p className="text-lux-on-dark-muted text-sm">
                      {manualDelivery ? 'L’assistante vous indiquera les prochaines étapes. Cette demande ne confirme pas l’existence d’un compte.' : 'Consultez WhatsApp si vous utilisez votre téléphone, ou votre boîte email et ses courriers indésirables. Si vous avez perdu ce contact, contactez Nexus pour une récupération accompagnée.'}
                    </p>
                  </div>

                  <div className="text-center space-y-3">
                    <Button asChild variant="outline" className="w-full border-lux-line/40 bg-white/5 text-lux-ivory hover:bg-white/10">
                      <Link href="/auth/signin">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Retour à la Connexion
                      </Link>
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsSuccess(false);
                        setEmail("");
                      }}
                      className="w-full text-lux-on-dark-muted hover:text-lux-ivory"
                    >
                      Renouveler la demande
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <CorporateFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-lux-ink text-lux-ivory">
      <CorporateNavbar />

      <main id="main-content" tabIndex={-1} className="py-12 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <div className="text-center mb-8">
            {/* Badge optionnel désactivé pour lint */}
            <h1 className="font-fraunces text-3xl font-light text-lux-ivory mb-4">
              Mot de Passe Oublié
            </h1>
            <p className="text-lux-on-dark-muted">
              Saisissez votre numéro WhatsApp ou votre adresse email pour demander la récupération de votre accès.
            </p>
          </div>

          <Card
            className="border border-lux-line/40 bg-white/5"
          >
            <CardHeader>
              <h2 className="text-center text-lux-ivory font-semibold leading-none tracking-tight">
                Récupérer mon accès
              </h2>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email" className="text-lux-on-dark-muted">Téléphone WhatsApp ou email</Label>
                  <Input
                    id="email"
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="+216 … ou votre email"
                    required
                    disabled={isLoading}
                    className="bg-white/5 text-lux-ivory placeholder:text-lux-on-dark-subtle border-lux-line/40"
                  />
                  <p className="text-xs text-lux-on-dark-muted mt-2">
                    La marche à suivre et le canal disponible seront indiqués après votre demande.
                  </p>
                </div>

                {error && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <p role="alert" className="text-amber-100 text-sm">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || !email}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Demande en cours...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Demander la récupération de mon accès
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/auth/signin" className="text-sm text-lux-gold hover:text-lux-ivory flex items-center justify-center">
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Retour à la connexion
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
