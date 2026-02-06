"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Clock, Mail, Phone } from "lucide-react";
import Link from "next/link";

export default function ConfirmationPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            {/* Icône de succès */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-8"
            >
              <CheckCircle className="w-10 h-10 text-green-600" aria-hidden="true" />
            </motion.div>

            {/* Titre principal */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-display text-3xl md:text-4xl font-bold text-neutral-900 mb-4"
            >
              Félicitations ! Votre Bilan est Créé
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-neutral-600 mb-12 max-w-2xl mx-auto"
            >
              Votre demande de bilan stratégique gratuit a été enregistrée avec succès.
              Notre équipe va analyser votre profil et vous contacter très prochainement.
            </motion.p>

            {/* Étapes suivantes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid md:grid-cols-3 gap-6 mb-12"
            >
              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mb-4">
                    <Clock className="w-6 h-6 text-primary-600" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Sous 24h</h3>
                  <p className="text-neutral-600 text-sm">
                    Notre équipe analyse votre profil et prépare votre bilan personnalisé
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary-100 rounded-full mb-4">
                    <Phone className="w-6 h-6 text-secondary-600" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Appel Découverte</h3>
                  <p className="text-neutral-600 text-sm">
                    Un échange de 30 minutes pour comprendre vos besoins et présenter nos solutions
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Plan d'Action</h3>
                  <p className="text-neutral-600 text-sm">
                    Nous vous proposons un plan personnalisé pour la réussite de votre enfant
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Informations importantes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-blue-50 rounded-xl p-6 mb-8"
            >
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-brand-primary mt-1" aria-hidden="true" />
                <div className="text-left">
                  <h3 className="font-semibold text-blue-900 mb-2">
                    Vérifiez votre boîte email
                  </h3>
                  <p className="text-blue-800 text-sm">
                    Un email de confirmation a été envoyé avec vos identifiants de connexion.
                    Si vous ne le trouvez pas, pensez à vérifier vos spams.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button asChild size="lg">
                <Link href="/">
                  Retour à l'Accueil
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg">
                <Link href="/contact">
                  Nous Contacter
                </Link>
              </Button>
            </motion.div>

            {/* Contact d'urgence */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-12 pt-8 border-t border-neutral-200"
            >
              <p className="text-neutral-600 text-sm">
                Une question urgente ? Contactez-nous directement au{' '}
                <a href="tel:+21699192829" className="text-brand-primary font-medium hover:underline">
                  +216 99 19 28 29
                </a>
                {' '}ou par email à{' '}
                <a href="mailto:contact@nexusreussite.academy" className="text-brand-primary font-medium hover:underline">
                  contact@nexusreussite.academy
                </a>
              </p>
            </motion.div>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
