"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { ArrowLeft, CheckCircle, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import Link from "next/link";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSuccess(true);
      } else {
        setError(data.error || "Une erreur est survenue. Veuillez réessayer.");
      }
    } catch {
      setError("Une erreur réseau est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-lux-ink text-lux-ivory">
        <CorporateNavbar />
        <main className="py-12 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-error/15 rounded-full mb-4">
              <Lock className="w-8 h-8 text-error" />
            </div>
            <h1 className="font-fraunces text-2xl font-light text-lux-ivory mb-4">
              Lien invalide
            </h1>
            <p className="text-lux-on-dark-muted mb-6">
              Ce lien de réinitialisation est invalide ou a expiré.
              Veuillez demander un nouveau lien.
            </p>
            <Button asChild variant="outline" className="border-lux-line/40 text-lux-ivory hover:bg-white/10">
              <Link href="/auth/mot-de-passe-oublie">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Demander un nouveau lien
              </Link>
            </Button>
          </div>
        </main>
        <CorporateFooter />
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-lux-ink text-lux-ivory">
        <CorporateNavbar />
        <main className="py-12 sm:py-20">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="font-fraunces text-2xl font-light text-lux-ivory mb-4">
              Mot de passe réinitialisé !
            </h1>
            <p className="text-lux-on-dark-muted mb-6">
              Votre mot de passe a été modifié avec succès.
              Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth/signin">
                Se connecter
              </Link>
            </Button>
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-lux-gold/10 rounded-full mb-6">
              <Lock className="w-8 h-8 text-lux-gold" aria-hidden="true" />
            </div>
            <h1 className="font-fraunces text-3xl font-light text-lux-ivory mb-4">
              Nouveau Mot de Passe
            </h1>
            <p className="text-lux-on-dark-muted">
              Saisissez votre nouveau mot de passe ci-dessous.
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
                  <Label htmlFor="newPassword" className="text-lux-on-dark-muted">
                    Nouveau mot de passe
                  </Label>
                  <div className="relative mt-2">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      required
                      minLength={8}
                      disabled={isLoading}
                      className="h-12 pr-12 bg-white/5 text-lux-ivory placeholder:text-lux-on-dark-subtle border-lux-line/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-lux-on-dark-muted hover:text-lux-ivory transition-colors"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-lux-on-dark-muted">
                    Confirmer le mot de passe
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmez votre mot de passe"
                    required
                    minLength={8}
                    disabled={isLoading}
                    className="mt-2 h-12 bg-white/5 text-lux-ivory placeholder:text-lux-on-dark-subtle border-lux-line/40"
                  />
                </div>

                {error && (
                  <div className="bg-error/10 border border-error/20 rounded-lg p-4" role="alert">
                    <p className="text-error text-sm font-medium">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full h-12" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Réinitialisation en cours...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4 mr-2" />
                      Réinitialiser le mot de passe
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/auth/signin"
                  className="text-sm text-lux-gold hover:text-lux-ivory flex items-center justify-center"
                >
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-lux-ink flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-lux-gold" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
