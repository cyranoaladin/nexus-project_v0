"use client";

import React from "react";
import Link from "next/link";
import {
  Award,
  Bot,
  Crown,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";

const testimonials = [
  {
    name: "Mme Ben Ali",
    role: "Mère d'élève Terminale S",
    quote:
      "Le suivi a été clair et rassurant. Mon fils a gagné en confiance et en méthode.",
  },
  {
    name: "M. Cherif",
    role: "Parent d'élève Première",
    quote:
      "ARIA et les coachs ont fait la différence. Le planning et les progrès étaient visibles chaque semaine.",
  },
  {
    name: "Mme Guesmi",
    role: "Parent d'élève Seconde",
    quote:
      "Un accompagnement humain, structuré et bienveillant. Nous avons enfin un cap clair.",
  },
];

export default function FamillePage() {
  return (
    <div className="min-h-screen bg-surface-darker text-slate-200 font-sans">
      <CorporateNavbar />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden py-24 bg-surface-darker">
          <div className="absolute inset-0 bg-gradient-to-b from-surface-darker via-surface-darker/70 to-surface-darker" />
          <div className="absolute -top-24 right-10 h-72 w-72 rounded-full bg-brand-accent/10 blur-[140px]" />
          <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-neutral-800/30 blur-[140px]" />

          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="max-w-4xl">
              <p className="inline-flex items-center rounded-full border border-brand-accent/40 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-brand-accent">
                Accompagnement Scolaire
              </p>
              <h1 className="marketing-hero-title mt-6">
                La mention au Bac, enfin à portée de main. (Sans sacrifier vos week-ends).
              </h1>
              <p className="marketing-hero-copy mt-6">
                Expertise humaine d&apos;excellence × Intelligence Artificielle 24/7.
                Nous garantissons la réussite au Bac ET l&apos;admission dans la
                formation supérieure de choix.
              </p>

              <div className="mt-10 grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Terminale",
                    text: "Je veux maximiser ses chances au Bac",
                  },
                  {
                    label: "Première",
                    text: "Je prépare l'avance pour Terminale",
                  },
                  {
                    label: "Seconde",
                    text: "Je veux construire des bases solides",
                  },
                ].map((item) => (
                  <a
                    key={item.label}
                    href="#offres"
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-md transition hover:border-brand-accent/50 hover:bg-white/10"
                  >
                    <div className="text-brand-accent text-sm font-semibold uppercase tracking-wider">
                      {item.label}
                    </div>
                    <div className="mt-2 text-white font-semibold">{item.text}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* PROBLÈME */}
        <section className="bg-surface-darker py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              Le soutien scolaire a évolué. Votre exigence aussi.
            </h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-6">
                <h3 className="text-xl font-semibold text-white">L&apos;Ancienne Méthode</h3>
                <ul className="mt-4 space-y-2 text-slate-300">
                  <li>• Un suivi opaque (pas de dashboard).</li>
                  <li>• Des répétiteurs, pas des pédagogues.</li>
                  <li>• Du bachotage court terme.</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-brand-accent/30 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">La Révolution Nexus</h3>
                <ul className="mt-4 space-y-2 text-slate-300">
                  <li>• Suivi Analytique & Temps réel.</li>
                  <li>• Des Agrégés qui parlent le langage de votre enfant.</li>
                  <li>• Un plan sur-mesure qui s&apos;adapte à SES difficultés.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* OFFRES */}
        <section id="offres" className="bg-surface-darker py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              Des parcours adaptés à chaque ambition.
            </h2>

            <div className="mt-10 rounded-3xl border border-brand-accent/40 bg-white/5 p-8 backdrop-blur-md">
              <div className="flex items-center gap-3 text-brand-accent text-sm font-semibold uppercase">
                <Crown className="h-5 w-5" />
                Le plus complet
              </div>
              <h3 className="mt-4 text-2xl md:text-3xl font-bold text-white">
                Le Programme Odyssée
              </h3>
              <p className="mt-3 text-slate-300">
                Accompagnement annuel, structuré pour sécuriser la mention et
                Parcoursup.
              </p>
              <div className="mt-6 grid gap-3 md:grid-cols-2 text-slate-300 text-sm">
                <div>• Suivi 360°</div>
                <div>• Tuteur IA inclus</div>
                <div>• Visio illimitée</div>
                <div>• Garantie Bac</div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-2 text-brand-accent">
                  <GraduationCap className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    Académies Nexus
                  </span>
                </div>
                <p className="mt-4 text-white font-semibold">
                  Stages intensifs vacances
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Sprints de performance pour progresser vite.
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="flex items-center gap-2 text-brand-accent">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">
                    Studio Flex
                  </span>
                </div>
                <p className="mt-4 text-white font-semibold">Cours à la carte</p>
                <p className="mt-2 text-sm text-slate-300">
                  Sessions ciblées selon les besoins du moment.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
              <div className="text-brand-accent text-sm font-semibold uppercase tracking-wider">
                Nexus Cortex
              </div>
              <p className="mt-2 text-white font-semibold">
                Juste besoin d&apos;un tuteur IA ?
              </p>
              <p className="text-slate-300 text-sm">
                Accès dès 29€/mois.
              </p>
            </div>
          </div>
        </section>

        {/* GARANTIE */}
        <section className="bg-surface-darker py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              Notre Pacte de Confiance.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-brand-accent/40 bg-white/5 p-6 text-center backdrop-blur-md">
                <ShieldCheck className="mx-auto h-8 w-8 text-brand-accent" />
                <h3 className="mt-4 text-xl font-semibold text-white">
                  Garantie Mention
                </h3>
                <p className="mt-2 text-slate-300">
                  Pas de mention ? 3 mois offerts.
                </p>
              </div>
              <div className="rounded-3xl border border-brand-accent/40 bg-white/5 p-6 text-center backdrop-blur-md">
                <Award className="mx-auto h-8 w-8 text-brand-accent" />
                <h3 className="mt-4 text-xl font-semibold text-white">
                  Garantie Parcoursup
                </h3>
                <p className="mt-2 text-slate-300">
                  Aucune proposition ? Coaching gratuit jusqu&apos;à la rentrée.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* PREUVES SOCIALES */}
        <section className="bg-surface-darker py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="marketing-section-title">
                Preuve sociale avancée
              </h2>
              <p className="mt-3 text-slate-300">
                Des résultats tangibles et une confiance retrouvée.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-brand-accent text-3xl font-bold">100%</div>
                <p className="mt-2 text-slate-300">Taux de réussite</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-brand-accent text-3xl font-bold">92%</div>
                <p className="mt-2 text-slate-300">
                  Mentions Bien/Très Bien
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <div className="text-brand-accent text-3xl font-bold">+150</div>
                <p className="mt-2 text-slate-300">Années d&apos;expertise cumulée</p>
              </div>
            </div>

            <div className="mt-6 text-center">
              <a
                href="/equipe"
                className="btn-outline-strong"
              >
                Découvrir nos profs Agrégés
              </a>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {testimonials.map((item) => (
                <div
                  key={item.name}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
                >
                  <div className="flex gap-1 text-brand-accent">
                    {[...Array(5)].map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-brand-accent" />
                    ))}
                  </div>
                  <p className="mt-4 text-slate-200">{item.quote}</p>
                  <div className="mt-4 text-sm text-slate-400">
                    {item.name} · {item.role}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section className="py-16">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <p className="marketing-eyebrow">
                    Prochaine étape
                  </p>
                  <h2 className="marketing-cta-title">
                    Obtenir un diagnostic personnalisé
                  </h2>
                  <p className="marketing-cta-copy">
                    Un bilan gratuit pour poser un plan clair, sans engagement.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link href="/bilan-gratuit" className="btn-primary">
                    Démarrer un bilan gratuit
                  </Link>
                  <Link href="/contact" className="btn-outline">
                    Parler à un expert
                  </Link>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 text-neutral-300">
                <Bot className="h-5 w-5 text-brand-accent" />
                <span>
                  Je peux analyser gratuitement ses derniers bulletins. Cliquez
                  pour discuter.
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <CorporateFooter />
    </div>
  );
}
