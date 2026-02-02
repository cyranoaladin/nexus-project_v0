"use client";

import React from "react";
import { Building2, Users, Briefcase } from "lucide-react";

export default function ProblemSolutionSection() {
  return (
    <section id="parcours" className="bg-midnight-950 py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
            Choisissez votre parcours
          </h2>
          <p className="mt-3 text-slate-300">
            Une entrée claire selon votre besoin, sans jargon technique.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <a
            href="#etablissements"
            className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-gold-500/50 hover:bg-white/10"
          >
            <div className="flex items-center gap-3 text-gold-400">
              <Building2 className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wider">
                ÉTABLISSEMENTS
              </span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">
              Difficulté à se différencier ?
            </h3>
            <p className="mt-2 text-slate-300">
              Devenez l&apos;école leader grâce à nos outils de pilotage.
            </p>
          </a>

          <a
            href="#parents_eleves"
            className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-gold-500/50 hover:bg-white/10"
          >
            <div className="flex items-center gap-3 text-gold-400">
              <Users className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wider">
                PARENTS & ÉLÈVES
              </span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">
              Besoin d&apos;un soutien personnalisé ?
            </h3>
            <p className="mt-2 text-slate-300">
              Visez l&apos;excellence avec ARIA, votre tuteur IA 24/7.
            </p>
          </a>

          <a
            href="#formation_tech"
            className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-gold-500/50 hover:bg-white/10"
          >
            <div className="flex items-center gap-3 text-gold-400">
              <Briefcase className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wider">
                PROFESSIONNELS
              </span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">
              Compétences obsolètes ?
            </h3>
            <p className="mt-2 text-slate-300">
              Maîtrisez les technologies de demain (IA, Web3).
            </p>
          </a>
        </div>
      </div>
    </section>
  );
}
