"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, getSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { track } from "@/lib/analytics";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResendActivation, setShowResendActivation] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [isResendingActivation, setIsResendingActivation] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");

  const getSafeRedirectUrl = (role?: string): string => {
    const roleRoutes: Record<string, string> = {
      ADMIN: '/dashboard/admin',
      ASSISTANTE: '/dashboard/assistante',
      COACH: '/dashboard/coach',
      PARENT: '/dashboard/parent',
      ELEVE: '/dashboard/eleve',
    };
    const defaultRoute = roleRoutes[role ?? ''] ?? '/dashboard/parent';

    if (callbackUrl && callbackUrl.startsWith('/')) {
      return callbackUrl;
    }
    return defaultRoute;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      track.signinAttempt();
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        track.signinError('invalid_credentials');
        setError("Email ou mot de passe incorrect. Vérifiez vos identifiants ou réinitialisez votre mot de passe.");
        setShowResendActivation(false);
        setResendEmail(email);
      } else {
        const session = await getSession();
        const role = (session?.user as { role?: string })?.role;
        track.signinSuccess(role ?? 'unknown');
        router.push(getSafeRedirectUrl(role));
      }
    } catch {
      track.signinError('network_error');
      setError("Une erreur est survenue lors de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendActivation = async () => {
    const targetEmail = resendEmail || email;
    if (!targetEmail) {
      setResendMessage("Saisissez votre email pour recevoir un nouveau lien.");
      return;
    }

    setIsResendingActivation(true);
    setResendMessage("");

    try {
      const response = await fetch('/api/auth/resend-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      });

      const data = await response.json() as { success?: boolean; message?: string; error?: string };

      if (!response.ok) {
        setResendMessage(data.error || 'Impossible de renvoyer le lien pour le moment.');
        return;
      }

      setResendMessage(data.message || 'Si ce compte existe, un nouveau lien a été envoyé.');
    } catch {
      setResendMessage('Impossible de renvoyer le lien pour le moment.');
    } finally {
      setIsResendingActivation(false);
    }
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-lux-gold/10 rounded-full mb-6">
          <LogIn className="w-8 h-8 text-lux-gold" aria-hidden="true" />
        </div>
        <h1 className="font-fraunces text-3xl font-light text-lux-ivory mb-4">
          Accédez à Votre Espace
        </h1>
        <p className="text-lux-on-dark-muted">
          Connectez-vous pour accéder à votre espace personnalisé et continuer
          votre parcours vers l'excellence.
        </p>
      </div>

      <div className="mb-8">
        <Card
          className="border border-lux-line/40 bg-white/5"
        >
          <CardHeader className="text-center pb-6">
            <h2 className="font-fraunces text-2xl font-light text-lux-ivory leading-none tracking-tight">
              Connexion à Votre Espace
            </h2>
            <p className="text-lux-on-dark-subtle text-sm mt-2">
              Saisissez vos identifiants pour accéder à votre tableau de bord
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="email" className="text-lux-on-dark-muted font-medium">
                  Adresse Email
                </Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre.email@exemple.com"
                  required
                  className="mt-2 h-12 bg-white/5 text-lux-ivory placeholder:text-lux-on-dark-subtle border-lux-line/40"
                />
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-lux-on-dark-muted font-medium">
                    Mot de Passe
                  </Label>
                  <Link
                    href="/auth/mot-de-passe-oublie"
                    className="text-sm text-lux-gold underline"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
                <div className="relative mt-2">
                  <Input
                    id="password"
                    data-testid="input-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    required
                    className="h-12 pr-12 bg-white/5 text-lux-ivory placeholder:text-lux-on-dark-subtle border-lux-line/40"
                  />
                  <button
                    type="button"
                    data-testid="btn-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-lux-on-dark-muted hover:text-lux-ivory transition-colors"
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

              {error && (
                <div className="bg-error/10 border border-error/20 rounded-lg p-4" role="alert">
                  <p className="text-error text-sm font-medium">{error}</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Link
                      href="/auth/mot-de-passe-oublie"
                      className="text-sm font-medium text-lux-gold hover:underline"
                    >
                      Réinitialiser le mot de passe
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setShowResendActivation((value) => !value);
                        setResendEmail((current) => current || email);
                      }}
                      className="text-left text-sm text-lux-on-dark-muted hover:text-lux-ivory hover:underline"
                    >
                      Renvoyer un lien d'activation
                    </button>
                  </div>
                </div>
              )}

              {showResendActivation && (
                <div className="rounded-lg border border-lux-line/40 bg-white/5 p-4 space-y-3">
                  <div>
                    <Label htmlFor="resend-email" className="text-lux-on-dark-muted font-medium">
                      Renvoyer le lien d'activation
                    </Label>
                    <Input
                      id="resend-email"
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      placeholder="votre.email@exemple.com"
                      className="mt-2 h-11 bg-white/5 text-lux-ivory placeholder:text-lux-on-dark-subtle border-lux-line/40"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-lux-line/40 text-lux-ivory hover:bg-white/10"
                    disabled={isResendingActivation}
                    onClick={handleResendActivation}
                  >
                    {isResendingActivation ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-label="Chargement" />
                        Envoi en cours...
                      </>
                    ) : (
                      "Renvoyer le lien d'activation"
                    )}
                  </Button>
                  {resendMessage && (
                    <p className="text-sm text-lux-on-dark-muted">{resendMessage}</p>
                  )}
                </div>
              )}

              <Button
                type="submit"
                data-testid="btn-signin"
                className="w-full h-12 font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" aria-label="Chargement" />
                    Connexion en cours...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" aria-hidden="true" />
                    Accéder à Mon Espace
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-lg border border-lux-line/40 bg-white/5 p-4 space-y-2">
              <p className="text-sm text-lux-on-dark-muted">
                <span className="font-semibold text-lux-gold">Parent ?</span>{" "}
                Connectez-vous avec votre adresse email personnelle.
              </p>
              <p className="text-sm text-lux-on-dark-muted">
                <span className="font-semibold text-emerald-400">Élève ?</span>{" "}
                Connectez-vous avec l'email élève reçu lors de votre inscription.
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-lux-line/40">
              <div className="text-center space-y-4">
                <p className="text-sm text-lux-on-dark-muted">
                  Pas encore de compte ?
                </p>
                <Button asChild variant="outline" className="w-full border-lux-line/40 text-lux-ivory hover:bg-white/10">
                  <Link href="/bilan-gratuit">
                    Créer mon Compte Gratuit
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-lux-on-dark-subtle">
                En vous connectant, vous acceptez nos{" "}
                <Link href="/conditions-generales" className="text-lux-gold underline">
                  conditions d'utilisation
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
