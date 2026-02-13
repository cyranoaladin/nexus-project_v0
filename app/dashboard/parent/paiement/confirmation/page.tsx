"use client"

import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Clock, Mail, Home } from "lucide-react"
import Link from "next/link"

export default function PaymentConfirmationPage() {
  return (
    <div className="min-h-screen bg-transparent">
      <main className="py-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-neutral-400">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/dashboard/parent/abonnements" className="hover:text-white transition">
                  Abonnements
                </Link>
              </li>
              <li>/</li>
              <li>
                <Link href="/dashboard/parent/paiement" className="hover:text-white transition">
                  Paiement
                </Link>
              </li>
              <li>/</li>
              <li className="text-neutral-200">Confirmation</li>
            </ol>
          </nav>
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
              className="inline-flex items-center justify-center w-20 h-20 bg-white/10 rounded-full mb-8"
            >
              <CheckCircle className="w-10 h-10 text-emerald-300" />
            </motion.div>

            {/* Titre principal */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="font-display text-3xl md:text-4xl font-bold text-white mb-4"
            >
              Paiement en Cours de Validation
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl text-neutral-300 mb-12 max-w-2xl mx-auto"
            >
              Votre demande de paiement a été enregistrée avec succès. 
              Notre équipe va valider votre virement et activer votre service très prochainement.
            </motion.p>

            {/* Étapes de validation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid md:grid-cols-2 gap-6 mb-12"
            >
              <Card className="text-center bg-white/5 border border-white/10">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
                    <Clock className="w-6 h-6 text-brand-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Validation en Cours</h3>
                  <p className="text-neutral-300 text-sm">
                    Notre équipe vérifie votre virement et valide votre commande sous 24-48h ouvrées
                  </p>
                </CardContent>
              </Card>

              <Card className="text-center bg-white/5 border border-white/10">
                <CardContent className="p-6">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-white/10 rounded-full mb-4">
                    <Mail className="w-6 h-6 text-emerald-300" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Confirmation par Email</h3>
                  <p className="text-neutral-300 text-sm">
                    Vous recevrez un email de confirmation dès que votre service sera activé
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Informations importantes */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white/5 rounded-xl p-6 mb-8 border border-white/10"
            >
              <div className="flex items-start space-x-3">
                <Mail className="w-5 h-5 text-brand-primary mt-1" />
                <div className="text-left">
                  <h3 className="font-semibold text-white mb-2">
                    Que se passe-t-il maintenant ?
                  </h3>
                  <ul className="text-neutral-300 text-sm space-y-1">
                    <li>• Notre équipe vérifie la réception de votre virement</li>
                    <li>• Votre abonnement/pack est activé automatiquement</li>
                    <li>• Vous recevez un email de confirmation avec vos accès</li>
                    <li>• Vous pouvez commencer à utiliser vos services</li>
                  </ul>
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
                <Link href="/dashboard/parent">
                  <Home className="w-4 h-4 mr-2" />
                  Retour au Dashboard
                </Link>
              </Button>
              
              <Button asChild variant="outline" size="lg">
                <Link href="/contact">
                  Une Question ?
                </Link>
              </Button>
            </motion.div>

            {/* Contact d'urgence */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-12 pt-8 border-t border-white/10"
            >
              <p className="text-neutral-300 text-sm">
                Une question sur votre paiement ? Contactez-nous au{' '}
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
    </div>
  )
}
