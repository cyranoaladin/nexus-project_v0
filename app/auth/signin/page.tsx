"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
// import { Badge } from "@/components/ui/badge"
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { track } from "@/lib/analytics";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
        setError("Email ou mot de passe incorrect");
      } else {
        const session = await getSession();
        const role = (session?.user as { role?: string })?.role;
        track.signinSuccess(role ?? 'unknown');
        const roleRoutes: Record<string, string> = {
          ADMIN: '/dashboard/admin',
          ASSISTANTE: '/dashboard/assistante',
          COACH: '/dashboard/coach',
          PARENT: '/dashboard/parent',
          ELEVE: '/dashboard/eleve',
        };
        router.push(roleRoutes[role ?? ''] ?? '/dashboard/parent');
      }
    } catch {
      track.signinError('network_error');
      setError("Une erreur est survenue lors de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-darker">
      <CorporateNavbar />

      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <div
            className="text-center mb-8 animate-[fadeInUp_0.6s_ease-out_both]"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-accent/10 rounded-full mb-6">
              <LogIn className="w-8 h-8 text-brand-accent" aria-hidden="true" />
            </div>
            <h1 className="font-display text-3xl font-bold text-white mb-4">
              Accédez à Votre Espace
            </h1>
            <p className="text-neutral-300">
              Connectez-vous pour accéder à votre espace personnalisé et continuer
              votre parcours vers l'excellence.
            </p>
          </div>

          <div
            className="animate-[fadeInUp_0.6s_ease-out_0.2s_both]"
          >
            <Card
              className="border border-white/10 shadow-lg bg-surface-card"
              style={{ backgroundColor: "rgb(var(--color-surface-card))" }}
            >
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-white">
                  Connexion à Votre Espace
                </CardTitle>
                <p className="text-neutral-400 text-sm mt-2">
                  Saisissez vos identifiants pour accéder à votre tableau de bord
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="email" className="text-neutral-200 font-medium">
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
                      className="mt-2 h-12 bg-surface-elevated text-neutral-100 placeholder:text-neutral-400 border-white/15"
                      style={{
                        backgroundColor: "rgb(var(--color-surface-elevated))",
                        color: "rgb(var(--color-neutral-100))",
                      }}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password" className="text-neutral-200 font-medium">
                        Mot de Passe
                      </Label>
                      <Link
                        href="/auth/mot-de-passe-oublie"
                        className="text-sm text-brand-accent-dark hover:underline"
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
                        className="h-12 pr-12 bg-surface-elevated text-neutral-100 placeholder:text-neutral-400 border-white/15"
                        style={{
                          backgroundColor: "rgb(var(--color-surface-elevated))",
                          color: "rgb(var(--color-neutral-100))",
                        }}
                      />
                      <button
                        type="button"
                        data-testid="btn-toggle-password"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-300 hover:text-neutral-100 transition-colors"
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
                    <div
                      className="bg-error/10 border border-error/20 rounded-lg p-4 animate-[fadeInUp_0.3s_ease-out_both]"
                      role="alert"
                    >
                      <p className="text-error text-sm font-medium">{error}</p>
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

                <div className="mt-6 rounded-lg border border-white/10 bg-white/5 p-4 space-y-2">
                  <p className="text-sm text-neutral-300">
                    <span className="font-semibold text-brand-accent">Parent ?</span>{" "}
                    Connectez-vous avec votre adresse email personnelle.
                  </p>
                  <p className="text-sm text-neutral-300">
                    <span className="font-semibold text-emerald-400">Élève ?</span>{" "}
                    Connectez-vous avec l&apos;email élève reçu lors de votre inscription.
                  </p>
                </div>

                <div className="mt-6 pt-6 border-t border-white/10">
                  <div className="text-center space-y-4">
                    <p className="text-sm text-neutral-300">
                      Pas encore de compte ?
                    </p>
                    <Button asChild variant="outline" className="w-full border-white/20 text-neutral-100 hover:bg-white/10">
                      <Link href="/bilan-gratuit">
                        Créer mon Compte Gratuit
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-xs text-neutral-400">
                    En vous connectant, vous acceptez nos{" "}
                    <Link href="/conditions" className="text-brand-accent hover:underline">
                      conditions d'utilisation
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
