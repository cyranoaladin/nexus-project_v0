"use client";

import React from "react";
import Link from "next/link";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import {
  BarChart3,
  BookOpen,
  Calendar,
  MessageSquare,
  Sparkles,
  TrendingUp,
} from "lucide-react";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-deep-midnight text-slate-200">
      <CorporateNavbar />

      <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-gold-400">
                Nexus Digital Campus
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Espace Élève
              </h2>
            </div>
            <nav className="space-y-3 text-sm">
              <button className="flex w-full items-center gap-3 rounded-lg bg-white/10 px-3 py-2 text-left text-white">
                <BarChart3 className="h-4 w-4 text-gold-400" />
                Tableau de bord
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-white/5">
                <BookOpen className="h-4 w-4 text-gold-400" />
                Mes cours
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-white/5">
                <Calendar className="h-4 w-4 text-gold-400" />
                Planning visio
              </button>
              <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-slate-300 hover:bg-white/5">
                <MessageSquare className="h-4 w-4 text-gold-400" />
                Messagerie
              </button>
            </nav>
          </aside>

          <section className="space-y-8">
            <header className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <p className="text-sm text-slate-300">Bonjour,</p>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                Thomas (Terminale S - Spé Maths/NSI)
              </h1>
            </header>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                <div className="flex items-center gap-3 text-gold-400">
                  <BarChart3 className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-wider">
                    Moyenne Générale
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">16.5/20</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                <div className="flex items-center gap-3 text-gold-400">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-wider">
                    Progression
                  </span>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  +1.2 pts
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
                <div className="flex items-center gap-3 text-gold-400">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-wider">
                    Korrigo
                  </span>
                </div>
                <p className="mt-4 text-lg font-semibold text-white">
                  Dernière copie : 18/20
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Voir le feedback IA
                </p>
              </div>
            </div>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h2 className="text-lg font-semibold text-white mb-4">
                Mes Cours & Offres
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-gold-400 text-sm font-semibold">
                    En cours
                  </p>
                  <h3 className="mt-2 text-white font-semibold">
                    Masterclass NSI - Algorithmes Gloutons
                  </h3>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-gold-400 text-sm font-semibold">
                    Suggéré
                  </p>
                  <h3 className="mt-2 text-white font-semibold">
                    Stage Intensif - Vacances Avril
                  </h3>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-gold-400 text-sm font-semibold">
                    Optionnel
                  </p>
                  <h3 className="mt-2 text-white font-semibold">
                    Module Web3 - Intro Solana
                  </h3>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h2 className="text-lg font-semibold text-white mb-4">
                Accompagnement
              </h2>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <button className="inline-flex items-center justify-center rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-black shadow-lg hover:bg-gold-400">
                  Discuter avec mon Tuteur IA
                </button>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="font-semibold text-white mb-2">
                    Prochains cours visio
                  </p>
                  <ul className="space-y-1">
                    <li>Mercredi 18:00 - Maths (Visio)</li>
                    <li>Vendredi 20:00 - NSI (Visio)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <h2 className="text-lg font-semibold text-white mb-4">
                Accès rapide
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <Link
                  href="/dashboard/eleve/mes-sessions"
                  className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-gold-500/50 hover:bg-white/10"
                >
                  <p className="text-gold-400 text-sm font-semibold">
                    Mes Sessions Visio
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Planning, liens de visio et compte-rendus.
                  </p>
                </Link>
                <Link
                  href="/dashboard/eleve/ressources"
                  className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:border-gold-500/50 hover:bg-white/10"
                >
                  <p className="text-gold-400 text-sm font-semibold">
                    Mes Ressources
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Supports de cours, fiches et exercices.
                  </p>
                </Link>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-gold-400 text-sm font-semibold">
                    Discuter avec ARIA
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    Coaching IA personnalisé et feedback.
                  </p>
                </div>
              </div>
            </section>
          </section>
        </div>
      </main>

      <CorporateFooter />
    </div>
  );
}
