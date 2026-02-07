"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
// import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import Link from "next/link";

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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Une erreur est survenue lors de la connexion");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <CorporateNavbar />

      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-brand-primary/10 rounded-full mb-6">
              <LogIn className="w-8 h-8 text-brand-primary" aria-hidden="true" />
            </div>
            <h1 className="font-display text-3xl font-bold text-neutral-900 mb-4">
              Bon Retour sur Nexus Réussite
            </h1>
            <p className="text-neutral-600">
              Connectez-vous pour accéder à votre espace personnalisé et continuer
              votre parcours vers l'excellence.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card className="border border-neutral-200 shadow-lg bg-white">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-2xl font-bold text-neutral-900">
                  Connexion à Votre Espace
                </CardTitle>
                <p className="text-neutral-600 text-sm mt-2">
                  Saisissez vos identifiants pour accéder à votre tableau de bord
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="email" className="text-neutral-900 font-medium">
                      Adresse Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre.email@exemple.com"
                      required
                      className="mt-2 h-12"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="password" className="text-neutral-900 font-medium">
                        Mot de Passe
                      </Label>
                      <Link
                        href="/auth/mot-de-passe-oublie"
                        className="text-sm text-brand-primary hover:underline"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>
                    <div className="relative mt-2">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Votre mot de passe"
                        required
                        className="h-12 pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500 hover:text-neutral-700 transition-colors"
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
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-error/10 border border-error/20 rounded-lg p-4"
                      role="alert"
                    >
                      <p className="text-error text-sm font-medium">{error}</p>
                    </motion.div>
                  )}

                  <Button
                    type="submit"
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

                <div className="mt-8 pt-6 border-t border-neutral-200">
                  <div className="text-center space-y-4">
                    <p className="text-sm text-neutral-600">
                      Pas encore de compte ?
                    </p>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/bilan-gratuit">
                        Créer mon Compte Gratuit
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 text-center">
                  <p className="text-xs text-neutral-500">
                    En vous connectant, vous acceptez nos{" "}
                    <Link href="/conditions" className="text-brand-primary hover:underline">
                      conditions d'utilisation
                    </Link>
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
