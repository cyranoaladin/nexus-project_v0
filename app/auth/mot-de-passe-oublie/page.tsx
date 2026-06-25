"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
// import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CheckCircle, Loader2, Mail } from "lucide-react";
import Link from "next/link";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
      } else {
        // Always show success to prevent email enumeration
        setIsSuccess(true);
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

        <main className="py-12 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="font-fraunces text-2xl font-light text-lux-ivory mb-4">
                Email Envoyé !
              </h1>
              <p className="text-lux-on-dark-muted">
                Si un compte existe avec cette adresse email, vous recevrez un lien
                de réinitialisation dans quelques minutes.
              </p>
            </div>

            <Card
              className="border border-lux-line/40 bg-white/5"
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="bg-lux-gold/10 border border-lux-gold/30 rounded-lg p-4">
                    <h3 className="font-semibold text-lux-gold mb-2">
                      Vérifiez votre boîte email
                    </h3>
                    <p className="text-lux-on-dark-muted text-sm">
                      Nous avons envoyé un lien de réinitialisation à <strong>{email}</strong>.
                      Pensez à vérifier vos spams si vous ne le trouvez pas.
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
                      Renvoyer l'email
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

      <main className="py-12 sm:py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <div className="text-center mb-8">
            {/* Badge optionnel désactivé pour lint */}
            <h1 className="font-fraunces text-3xl font-light text-lux-ivory mb-4">
              Mot de Passe Oublié
            </h1>
            <p className="text-lux-on-dark-muted">
              Saisissez votre adresse email pour recevoir un lien de réinitialisation
            </p>
          </div>

          <Card
            className="border border-lux-line/40 bg-white/5"
          >
            <CardHeader>
              <CardTitle className="text-center text-lux-ivory">
                Réinitialiser le Mot de Passe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email" className="text-lux-on-dark-muted">Adresse Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@exemple.com"
                    required
                    disabled={isLoading}
                    className="bg-white/5 text-lux-ivory placeholder:text-lux-on-dark-subtle border-lux-line/40"
                  />
                  <p className="text-xs text-lux-on-dark-muted mt-2">
                    Nous vous enverrons un lien sécurisé pour créer un nouveau mot de passe.
                  </p>
                </div>

                {error && (
                  <div className="bg-slate-1000/10 border border-slate-500/30 rounded-lg p-3">
                    <p className="text-slate-200 text-sm">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || !email}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Envoyer le Lien de Réinitialisation
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
