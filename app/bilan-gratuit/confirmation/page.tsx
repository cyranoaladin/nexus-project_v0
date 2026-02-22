"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Clock, Mail, Phone } from "lucide-react";
import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <CorporateNavbar />

      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Icône de succès */}
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-8"
            >
              <CheckCircle className="w-10 h-10 text-green-600" aria-hidden="true" />
            </motion.div>

            {/* Titre principal */}
            <motion.h1
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0 }}
              className="font-display text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Félicitations ! Votre Bilan est Créé
            </motion.h1>

            <motion.p
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0 }}
              className="text-xl text-neutral-300 mb-12 max-w-2xl mx-auto"
            >
              Votre demande de bilan stratégique gratuit a été enregistrée avec succès.
              Notre équipe va analyser votre profil et vous contacter très prochainement.
            </motion.p>

            {/* Étapes suivantes */}
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0 }}
              className="grid md:grid-cols-3 gap-6 mb-12"
            >
              <Card className="text-center bg-surface-card border border-white/10">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-accent/15 rounded-full mb-4">
                    <Clock className="w-6 h-6 text-brand-accent" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-white">Sous 24h</h3>
                  <p className="text-neutral-400 text-sm">
                    Notre équipe analyse votre profil et prépare votre bilan personnalisé
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center bg-surface-card border border-white/10">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/15 rounded-full mb-4">
                    <Phone className="w-6 h-6 text-blue-400" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-white">Appel Découverte</h3>
                  <p className="text-neutral-400 text-sm">
                    Un échange de 30 minutes pour comprendre vos besoins et présenter nos solutions
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center bg-surface-card border border-white/10">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-secondary/20 rounded-full mb-4">
                    <CheckCircle className="w-6 h-6 text-brand-secondary" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-white">Plan d'Action</h3>
                  <p className="text-neutral-400 text-sm">
                    Nous vous proposons un plan personnalisé pour la réussite de votre enfant
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Informations importantes */}
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0 }}
              className="bg-brand-accent/10 border border-brand-accent/20 rounded-xl p-6 mb-8"
            >
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-brand-accent mt-1" aria-hidden="true" />
                <div className="text-left">
                  <h3 className="font-semibold text-white mb-2">
                    Vérifiez votre boîte email
                  </h3>
                  <p className="text-neutral-300 text-sm">
                    Un email de confirmation a été envoyé avec vos identifiants de connexion.
                    Si vous ne le trouvez pas, pensez à vérifier vos spams.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button asChild size="lg">
                <Link href="/auth/signin">
                  Se Connecter
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg" className="border-white/20 text-neutral-100 hover:bg-white/10">
                <Link href="/">
                  Retour à l'Accueil
                </Link>
              </Button>
            </motion.div>

            {/* Contact d'urgence */}
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0 }}
              className="mt-12 pt-8 border-t border-white/10"
            >
              <p className="text-neutral-400 text-sm">
                Une question urgente ? Contactez-nous directement au{' '}
                <a href="tel:+21699192829" className="text-brand-accent font-medium hover:underline">
                  +216 99 19 28 29
                </a>
                {' '}ou par email à{' '}
                <a href="mailto:contact@nexusreussite.academy" className="text-brand-accent font-medium hover:underline">
                  contact@nexusreussite.academy
                </a>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
