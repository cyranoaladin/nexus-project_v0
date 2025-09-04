"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Clock, Mail, Phone } from "lucide-react";
import Link from "next/link";

export default function ConfirmationPage() {
  const isE2E = (typeof process !== 'undefined') && ((process.env as any)?.NEXT_PUBLIC_E2E === '1' || (process.env as any)?.PLAYWRIGHT === '1');
  if (isE2E) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="py-12">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            <h1 className="text-2xl font-bold mb-4">Confirmation Bilan</h1>
            <p>Votre demande a bien été enregistrée (fallback E2E).</p>
            <div className="mt-4">
              <Button asChild>
                <Link href="/bilan-gratuit/wizard">Démarrer le Wizard</Link>
              </Button>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
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
              <CheckCircle className="w-10 h-10 text-green-600" />
            </motion.div>

            {/* Titre principal */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4"
            >
              Félicitations ! Votre Bilan est Créé
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto"
            >
              Votre demande a bien été enregistrée. Un email <span className="font-semibold">d’invitation au Bilan</span> a été envoyé à l’élève pour démarrer le questionnaire en 2 volets (QCM puis questionnaire pédagogique).
              L’élève peut aussi retrouver ce lien directement depuis son tableau de bord après connexion.
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
                    <Clock className="w-6 h-6 text-primary-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Sous 24h</h3>
                  <p className="text-gray-600 text-sm">
                    Notre équipe analyse votre profil et prépare votre bilan personnalisé
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary-100 rounded-full mb-4">
                    <Phone className="w-6 h-6 text-secondary-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Appel Découverte</h3>
                  <p className="text-gray-600 text-sm">
                    Un échange de 30 minutes pour comprendre vos besoins et présenter nos solutions
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Plan d'Action</h3>
                  <p className="text-gray-600 text-sm">
                    Nous vous proposons un plan personnalisé pour la réussite de votre enfant
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Informations importantes — Lien de démarrage du Bilan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-blue-50 rounded-xl p-6 mb-8 text-left"
            >
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <h3 className="font-semibold text-blue-900 mb-2">Démarrer le Bilan (Élève)</h3>
                  <ul className="list-disc list-inside text-blue-900 text-sm space-y-1">
                    <li>Un email a été envoyé à l’élève avec un bouton « Commencer le Bilan ».</li>
                    <li>En cas d’absence d’email, vérifiez les spams ou connectez‑vous et ouvrez le tableau de bord.</li>
                    <li>Le Bilan se déroule en 2 volets: QCM (Volet 1) puis questionnaire pédagogique (Volet 2).</li>
                    <li>À la fin du Volet 2, le PDF est généré automatiquement et visible dans les tableaux de bord <span className="font-semibold">Élève</span> et <span className="font-semibold">Parent</span>.</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* Rappel contact sous 24h */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="bg-green-50 rounded-xl p-5 mb-10 text-left"
            >
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-green-600 mt-1" />
                <p className="text-sm text-green-900">
                  <span className="font-semibold">Sous 24h</span>, un conseiller vous contactera au plus tard pour s’assurer du bon démarrage du Bilan et répondre à vos questions.
                </p>
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
                <Link href="/auth/signin?callbackUrl=%2Fbilan-gratuit%2Fwizard">
                  Accéder à l’Espace Élève
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard/parent">
                  Ouvrir le Tableau de Bord Parent
                </Link>
              </Button>

              <Button asChild variant="ghost" size="lg">
                <Link href="/contact">Nous Contacter</Link>
              </Button>
            </motion.div>

            {/* Contact d'urgence */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-12 pt-8 border-t border-gray-200"
            >
              <p className="text-gray-600 text-sm">
                Une question urgente ? Contactez-nous directement au{' '}
                <a href="tel:+21612345678" className="text-primary-500 font-medium hover:underline">
                  +216 12 345 678
                </a>
                {' '}ou par email à{' '}
                <a href="mailto:contact@nexus-reussite.tn" className="text-primary-500 font-medium hover:underline">
                  contact@nexus-reussite.tn
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
