'use client';

import { AriaWidget } from '@/components/ui/aria-widget';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { BrainCircuit, MessageCircle } from 'lucide-react';
import { useState } from 'react';

export function MicroEngagementSection() {
  const [showAriaWidget, setShowAriaWidget] = useState(false);

  return (
    <>
      <section className="py-16 bg-gradient-to-br from-blue-50 to-white">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Titre Micro-Engagement */}
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Curieux de voir <span className="text-blue-600">ARIA en action</span> ?
            </h2>

            <p className="text-xl text-slate-600 mb-8">
              Découvrez comment notre IA pédagogique s'adapte à votre profil d'apprentissage unique
            </p>

            {/* CTA Micro-Engagement */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-block"
            >
              <Button
                onClick={() => setShowAriaWidget(true)}
                className="btn-primary h-14 px-8 text-lg group relative overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <BrainCircuit className="w-6 h-6" />
                  <span>Testez notre IA : "Quel est mon profil d'apprenant ?"</span>
                  <MessageCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
                </div>

                {/* Effet de brillance */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:translate-x-full transition-transform duration-1000"></div>
              </Button>
            </motion.div>

            {/* Indicateurs de confiance */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-slate-600"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Réponse instantanée</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>Analyse personnalisée</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>100% gratuit</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Widget ARIA */}
      <AriaWidget
        isOpen={showAriaWidget}
        onClose={() => setShowAriaWidget(false)}
        initialPrompt="Quel est mon profil d'apprenant ?"
      />
    </>
  );
}
