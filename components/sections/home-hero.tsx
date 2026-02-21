"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Rocket,
  GraduationCap,
  Bot,
  CheckCircle2,
  Landmark,
  Network,
} from "lucide-react";

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

export default function HomeHero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-surface-darker text-white">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-surface-darker via-surface-darker/70 to-surface-darker" />
        <div className="absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-brand-accent/10 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-neutral-800/20 blur-[140px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center">
        <div className="container mx-auto px-4">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="max-w-3xl"
            >
              <motion.div variants={fadeInUp} className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-accent/40 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-brand-accent backdrop-blur-md">
                  <Rocket className="h-4 w-4" />
                  Votre Partenaire Éducation 360°
                </div>
              </motion.div>

              <motion.h1
                variants={fadeInUp}
                className="text-4xl font-bold tracking-tight text-white md:text-6xl lg:text-7xl font-display"
              >
                Votre vision éducative, enfin réalisable à l&apos;ère de l&apos;IA.
              </motion.h1>

              <motion.p
                variants={fadeInUp}
                className="mt-6 max-w-2xl text-lg text-slate-300 md:text-xl"
              >
                Nous transformons l&apos;ambition des établissements en résultats mesurables. Comment ? En unissant 25 ans d&apos;expérience terrain (Agrégés, Universitaires) à la puissance des intelligences artificielles les plus avancées.
              </motion.p>

              <motion.div
                variants={fadeInUp}
                className="mt-8 flex flex-col gap-4 sm:flex-row"
              >
                <a
                  href="/contact"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-brand-accent to-brand-accent-dark px-8 text-sm font-semibold text-surface-dark shadow-lg hover:shadow-[0_0_24px_rgba(46,233,246,0.3)]"
                >
                  Parler à un expert
                </a>
                <a
                  href="#methodologie"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-brand-accent px-8 text-sm font-semibold text-white transition hover:bg-brand-accent/10"
                >
                  Découvrir notre méthode
                </a>
              </motion.div>
            </motion.div>

            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-white/0 blur-2xl" />
              <div className="relative rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl">
                <div className="relative">
                  <svg
                    className="absolute inset-0 h-full w-full opacity-40"
                    viewBox="0 0 400 400"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <line x1="200" y1="200" x2="120" y2="120" stroke="#EAB308" strokeOpacity="0.2" strokeWidth="0.5" />
                    <line x1="200" y1="200" x2="280" y2="120" stroke="#EAB308" strokeOpacity="0.2" strokeWidth="0.5" />
                    <line x1="200" y1="200" x2="120" y2="280" stroke="#EAB308" strokeOpacity="0.2" strokeWidth="0.5" />
                    <line x1="200" y1="200" x2="280" y2="280" stroke="#EAB308" strokeOpacity="0.2" strokeWidth="0.5" />
                  </svg>

                  <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-brand-accent/50 bg-surface-darker shadow-[0_0_30px_rgba(46,233,246,0.2)]">
                    <Network className="h-6 w-6 text-brand-accent" />
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-slate-200">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-brand-accent/60 hover:shadow-[0_0_24px_rgba(46,233,246,0.2)]">
                      <div className="flex items-center gap-2 text-brand-accent">
                        <GraduationCap className="h-5 w-5" />
                        <span className="text-sm font-semibold">Nexus Academy</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Coaching Excellence & Visio
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-brand-accent/60 hover:shadow-[0_0_24px_rgba(46,233,246,0.2)]">
                      <div className="flex items-center gap-2 text-brand-accent">
                        <Bot className="h-5 w-5" />
                        <span className="text-sm font-semibold">Agent ARIA</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Tuteur IA disponible 24/7
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-brand-accent/60 hover:shadow-[0_0_24px_rgba(46,233,246,0.2)]">
                      <div className="flex items-center gap-2 text-brand-accent">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-semibold">Dashboard Parent</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Suivi & Pilotage
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-brand-accent/60 hover:shadow-[0_0_24px_rgba(46,233,246,0.2)]">
                      <div className="flex items-center gap-2 text-brand-accent">
                        <Landmark className="h-5 w-5" />
                        <span className="text-sm font-semibold">Audit & Conseil</span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        Transformation des Écoles
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Visuel */}
          </div>
        </div>
      </div>
    </section>
  );
}
