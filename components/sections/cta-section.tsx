'use client';

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, Clock, Shield } from 'lucide-react';
import Link from 'next/link';

export function CTASection() {
  const benefits = [
    {
      icon: CheckCircle,
      text: 'Bilan personnalisé gratuit',
    },
    {
      icon: Clock,
      text: 'Réponse sous 24h',
    },
    {
      icon: Shield,
      text: 'Sans engagement',
    },
  ];

  return (
    <section className="section-container bg-gradient-to-br from-blue-600 via-blue-700 to-red-500 relative overflow-hidden">
      {/* Formes décoratives améliorées */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="content-centered relative">
        <div className="content-centered">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="fade-in-up"
          >
            <h2 className="font-heading text-4xl md:text-6xl font-bold text-white mb-8 leading-tight">
              Prêt à Conquérir le <span className="text-blue-100">Bac</span> et Vos{' '}
              <span className="text-blue-100">Objectifs</span> ?
            </h2>
            <p className="text-xl md:text-2xl text-white/90 mb-12 max-w-4xl mx-auto leading-relaxed">
              Commencez par un bilan stratégique gratuit et découvrez comment notre approche unique
              peut garantir votre{' '}
              <span className="text-blue-100 font-semibold">réussite au Baccalauréat</span> et votre{' '}
              <span className="text-blue-100 font-semibold">excellence à Parcoursup</span>.
            </p>
          </motion.div>

          {/* Avantages améliorés */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-8 mb-12"
          >
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={index}
                  className="flex items-center space-x-3 text-white/90 bg-white/10 rounded-full px-6 py-3 backdrop-blur-sm"
                >
                  <Icon className="w-6 h-6" />
                  <span className="font-semibold text-lg">{benefit.text}</span>
                </div>
              );
            })}
          </motion.div>

          {/* CTA Principal amélioré */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row gap-6 justify-center mb-8"
          >
            <Button
              asChild
              className="bg-white text-blue-600 hover:bg-gray-100 shadow-2xl group font-bold h-16 px-8 text-lg transform transition-all duration-300 hover:scale-105"
            >
              <Link href="/bilan-gratuit">
                Commencer mon Bilan Stratégique Gratuit
                <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              className="border-2 border-white text-white hover:bg-white hover:text-blue-600 font-bold h-16 px-8 text-lg transform transition-all duration-300 hover:scale-105 bg-transparent"
            >
              <Link href="/contact">Poser une Question</Link>
            </Button>
          </motion.div>

          {/* Note de confiance améliorée */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <p className="text-white/80 text-lg font-medium">
              Prêt à construire l'avenir de votre enfant ? Commencez par un échange avec nos
              experts.
            </p>
            <div className="flex justify-center mt-4 space-x-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-white/60 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
