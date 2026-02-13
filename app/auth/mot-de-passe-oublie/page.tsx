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
      // Simulation d'envoi d'email de réinitialisation
      // TODO: Implémenter la logique réelle de reset password
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsSuccess(true);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-surface-darker text-neutral-100">
        <CorporateNavbar />

        <main className="py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 rounded-full mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h1 className="font-display text-2xl font-bold text-white mb-4">
                Email Envoyé !
              </h1>
              <p className="text-neutral-300">
                Si un compte existe avec cette adresse email, vous recevrez un lien
                de réinitialisation dans quelques minutes.
              </p>
            </div>

            <Card
              className="border border-white/10 bg-surface-card shadow-premium"
              style={{ backgroundColor: "rgb(var(--color-surface-card))" }}
            >
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="bg-brand-accent/10 border border-brand-accent/30 rounded-lg p-4">
                    <h3 className="font-semibold text-brand-accent mb-2">
                      Vérifiez votre boîte email
                    </h3>
                    <p className="text-neutral-200 text-sm">
                      Nous avons envoyé un lien de réinitialisation à <strong>{email}</strong>.
                      Pensez à vérifier vos spams si vous ne le trouvez pas.
                    </p>
                  </div>

                  <div className="text-center space-y-3">
                    <Button asChild variant="outline" className="w-full border-white/10 bg-white/5 text-white hover:bg-white/10">
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
                      className="w-full text-neutral-300 hover:text-white"
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
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <CorporateNavbar />

      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <div className="text-center mb-8">
            {/* Badge optionnel désactivé pour lint */}
            <h1 className="font-display text-3xl font-bold text-white mb-4">
              Mot de Passe Oublié
            </h1>
            <p className="text-neutral-300">
              Saisissez votre adresse email pour recevoir un lien de réinitialisation
            </p>
          </div>

          <Card
            className="border border-white/10 bg-surface-card shadow-premium"
            style={{ backgroundColor: "rgb(var(--color-surface-card))" }}
          >
            <CardHeader>
              <CardTitle className="text-center text-white">
                Réinitialiser le Mot de Passe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="email" className="text-neutral-200">Adresse Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@exemple.com"
                    required
                    disabled={isLoading}
                    className="bg-surface-elevated text-neutral-100 placeholder:text-neutral-400 border-white/15"
                    style={{
                      backgroundColor: "rgb(var(--color-surface-elevated))",
                      color: "rgb(var(--color-neutral-100))",
                    }}
                  />
                  <p className="text-xs text-neutral-300 mt-2">
                    Nous vous enverrons un lien sécurisé pour créer un nouveau mot de passe.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-red-300 text-sm">{error}</p>
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
                <Link href="/auth/signin" className="text-sm text-brand-accent-dark hover:text-white flex items-center justify-center">
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
