"use client";

import React from "react";
import {
  MapPin,
  Clock,
  Phone,
  Mail,
  MonitorPlay,
  Cpu,
  Coffee,
  Mic,
  Wifi,
} from "lucide-react";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";

export default function NotreCentrePage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Nexus Réussite",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Immeuble VENUS, Apt. C13, Centre Urbain Nord",
      postalCode: "1082",
      addressLocality: "Tunis",
      addressCountry: "TN",
    },
    telephone: "+216 99 19 28 29",
    email: "contact@nexusreussite.academy",
  };

  return (
    <div className="min-h-screen bg-surface-darker text-slate-200">
      <CorporateNavbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-midnight-950 py-24">
          <div className="absolute inset-0 bg-gradient-to-b from-midnight-950 via-midnight-950/70 to-midnight-950" />
          <div className="absolute right-10 top-8 h-64 w-64 rounded-full bg-gold-500/10 blur-[120px]" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <div>
                <h1 className="text-4xl md:text-6xl font-bold text-white font-serif">
                  Votre Campus d&apos;Excellence à Tunis.
                </h1>
                <p className="mt-5 text-lg text-slate-300">
                  Le seul centre qui combine salles de classe premium, Lab IA
                  et espace parents. Venez voir la différence.
                </p>
                <a
                  href="#visite"
                  className="mt-8 inline-flex items-center justify-center rounded-full bg-gold-500 px-8 py-3 text-sm font-semibold text-black hover:bg-gold-400 transition"
                >
                  Réserver ma visite guidée
                </a>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-white/10 via-black/30 to-black/60 flex items-center justify-center text-slate-300">
                  Architecture Moderne · Classe Premium
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* EXPÉRIENCE */}
        <section className="bg-midnight-950 py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              L&apos;Expérience Nexus
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Salles Premium",
                  desc: "6 élèves max, écrans interactifs.",
                  icon: MonitorPlay,
                },
                {
                  title: "Lab IA ARIA",
                  desc: "Stations dédiées pour l'apprentissage assisté.",
                  icon: Cpu,
                },
                {
                  title: "Espace Parents",
                  desc: "Café & Wifi pour travailler pendant son cours.",
                  icon: Coffee,
                },
                {
                  title: "Studio Grand Oral",
                  desc: "Entraînement en conditions réelles.",
                  icon: Mic,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
                  >
                    <Icon className="h-6 w-6 text-gold-400" />
                    <h3 className="mt-4 text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* VISITE VIRTUELLE */}
        <section className="bg-midnight-950 py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              Entrez dans l&apos;excellence.
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {["L'Accueil", "La Salle Turing", "Le Labo", "L'Espace Détente"].map(
                (label) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md"
                  >
                    <div className="aspect-video rounded-xl bg-gradient-to-br from-white/10 via-black/30 to-black/60" />
                    <p className="mt-3 text-sm text-slate-300">{label}</p>
                  </div>
                )
              )}
            </div>
          </div>
        </section>

        {/* POURQUOI LE CENTRE */}
        <section className="bg-midnight-950 py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Focus Total",
                  desc: "Un environnement sans distraction.",
                },
                {
                  title: "Matériel Pro",
                  desc: "Tablettes et écrans fournis.",
                },
                {
                  title: "Émulation",
                  desc: "Travailler avec d'autres élèves motivés.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md"
                >
                  <h3 className="text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NOUS TROUVER */}
        <section className="bg-midnight-950 py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-8 lg:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
                <h2 className="text-2xl font-bold text-white font-serif">
                  Nous trouver
                </h2>
                <div className="mt-6 space-y-4 text-slate-300 text-sm">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gold-400 mt-0.5" />
                    <div>
                      Immeuble VENUS, Apt. C13<br />
                      Centre Urbain Nord, 1082 Tunis
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-gold-400" />
                    <span>Lun-Sam : 09h - 20h</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gold-400" />
                    <span>+216 99 19 28 29</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gold-400" />
                    <span>contact@nexusreussite.academy</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Wifi className="h-4 w-4 text-gold-400" />
                    <span>Wifi haut débit pour les familles</span>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-white/10 via-black/30 to-black/60 flex items-center justify-center text-slate-300">
                  Carte interactive (Google Maps)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA FINAL */}
        <section id="visite" className="bg-midnight-950 py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl border border-gold-500/40 bg-white/5 p-10 text-center backdrop-blur-md">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                La confiance se gagne sur place.
              </h2>
              <a
                href="/contact"
                className="mt-6 inline-flex items-center justify-center rounded-full bg-gold-500 px-8 py-3 text-sm font-semibold text-black hover:bg-gold-400 transition"
              >
                Prendre rendez-vous pour une visite
              </a>
            </div>
          </div>
        </section>
      </main>

      <CorporateFooter />
    </div>
  );
}
