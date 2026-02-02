"use client";

import React from "react";
import { BrainCircuit, Scale, LineChart, Users } from "lucide-react";

export default function KorrigoFeatures() {
  return (
    <section className="bg-midnight-950 text-white py-20 md:py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-serif font-bold">
            Au-delà de la logistique : l&apos;Intelligence Pédagogique.
          </h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gold-500/40 bg-white/5 p-6 shadow-2xl shadow-gold-500/10">
            <div className="flex items-center gap-3 text-gold-400 mb-3">
              <BrainCircuit className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Smart Feedback (IA + RAG)
              </span>
            </div>
            <p className="text-white font-semibold mb-2">
              Du simple score au conseil personnalisé.
            </p>
            <p className="text-slate-300 text-sm">
              Notre IA analyse vos annotations, le corrigé-type et le barème
              pour rédiger une synthèse constructive unique pour chaque élève.
              Offrez une remédiation immédiate.
            </p>
          </div>

          <div className="rounded-2xl border border-gold-500/40 bg-white/5 p-6 shadow-2xl shadow-gold-500/10">
            <div className="flex items-center gap-3 text-gold-400 mb-3">
              <Scale className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">
                Live Harmonizer
              </span>
            </div>
            <p className="text-white font-semibold mb-2">
              Garantissez l&apos;équité du diplôme.
            </p>
            <p className="text-slate-300 text-sm">
              Détection temps réel des écarts de notation entre correcteurs.
              Outils de lissage et double correction aveugle pour les examens à
              fort enjeu.
            </p>
          </div>
        </div>

        <div className="grid gap-4 mt-10 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-gold-400 mb-2">
              <LineChart className="h-4 w-4" />
              <span className="text-sm font-semibold">
                Pour l&apos;Administration
              </span>
            </div>
            <p className="text-slate-300 text-sm">
              Gain logistique, zéro infrastructure spécifique, marque blanche.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-gold-400 mb-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-semibold">Pour les Enseignants</span>
            </div>
            <p className="text-slate-300 text-sm">
              Confort de correction, fin des calculs d&apos;épicier, gain de
              temps.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-gold-400 mb-2">
              <LineChart className="h-4 w-4" />
              <span className="text-sm font-semibold">
                Pour Étudiants/Familles
              </span>
            </div>
            <p className="text-slate-300 text-sm">
              Accès copie numérisée, feedback IA détaillé, transparence.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
