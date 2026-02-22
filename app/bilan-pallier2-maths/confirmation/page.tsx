"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CheckCircle, GraduationCap, Mail, ArrowRight, Clock, Target, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const diagnosticId = searchParams.get('id');
  const publicShareId = searchParams.get('share');
  const bilanLinkId = publicShareId || diagnosticId;

  return (
    <div className="min-h-screen bg-surface-darker">
      <CorporateNavbar />

      <main className="py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 mb-6">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            
            <Badge variant="outline" className="mb-4 border-brand-accent/40 bg-brand-accent/10 text-brand-accent">
              <Target className="w-4 h-4 mr-2" />
              Bilan Envoyé
            </Badge>
            
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
              Bilan Diagnostic Enregistré
            </h1>
            
            <p className="text-lg text-slate-300 max-w-xl mx-auto">
              Votre <strong>Bilan Diagnostic Pré-Stage</strong> a été transmis avec succès. 
              Notre équipe pédagogique va l'analyser pour générer votre rapport personnalisé.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border border-white/10 bg-white/5 mb-8">
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg">
                    <Clock className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Prochaines étapes
                    </h3>
                    <p className="text-slate-300 text-sm">
                      Notre IA va analyser votre profil et générer 3 rapports personnalisés sous quelques minutes :
                      un pour l&apos;élève, un pour les parents, et une fiche pédagogique pour votre coach.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3 p-4 bg-white/5 rounded-lg">
                    <div className="p-2 bg-brand-accent/20 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-brand-accent" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium text-sm">Votre diagnostic détaillé</h4>
                      <p className="text-slate-300 text-xs mt-1">
                        Score de préparation, forces, priorités et profil d&apos;apprentissage
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-white/5 rounded-lg">
                    <div className="p-2 bg-brand-accent/20 rounded-lg">
                      <GraduationCap className="w-5 h-5 text-brand-accent" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium text-sm">Plan de stage personnalisé</h4>
                      <p className="text-slate-300 text-xs mt-1">
                        Modules recommandés, exercices ciblés et objectifs concrets
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-slate-200 text-sm">
                    <strong>Important :</strong> Pour finaliser votre inscription au stage, 
                    cliquez sur le bouton ci-dessous pour accéder au paiement.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            {bilanLinkId && (
              <Link href={`/bilan-pallier2-maths/resultat/${bilanLinkId}`}>
                <Button className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700">
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Consulter mon bilan
                </Button>
              </Link>
            )}
            <Link href="/offres?programme=hybride">
              <Button className="w-full sm:w-auto px-8 py-3 bg-brand-accent hover:bg-brand-accent/90">
                <ArrowRight className="w-5 h-5 mr-2" />
                Finaliser l&apos;inscription
              </Button>
            </Link>
            
            <Link href="/">
              <Button variant="outline" className="w-full sm:w-auto px-8 py-3">
                Retour à l&apos;accueil
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 text-center"
          >
            <p className="text-slate-300 text-sm mb-4">
              Une question ? Notre équipe est disponible
            </p>
            <div className="flex items-center justify-center gap-2 text-brand-accent">
              <Mail className="w-4 h-4" />
              <a href="mailto:contact@nexusreussite.tn" className="hover:underline">
                contact@nexusreussite.tn
              </a>
            </div>
          </motion.div>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}

export default function BilanPallier2ConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-darker" />}>
      <ConfirmationContent />
    </Suspense>
  );
}
