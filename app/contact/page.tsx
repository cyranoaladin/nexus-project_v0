"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import ContactSection from "@/components/sections/contact-section";
import { Badge } from "@/components/ui/badge";
import { MapPin, MessageCircle, Phone } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-deep-midnight text-slate-200 selection:bg-gold-500/20 selection:text-gold-400">
      <Header />

      <main className="relative overflow-hidden py-16 sm:py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-deep-midnight via-deep-midnight/70 to-deep-midnight" />
        <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-gold-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-midnight-blue/10 blur-3xl" />

        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-4 border-gold-500/40 text-gold-500">
              Réponse garantie 7j/7
            </Badge>
            <h1 className="font-heading text-3xl font-bold text-white md:text-4xl lg:text-5xl">
              Votre première question mérite une réponse d'expert.
            </h1>
            <p className="mt-4 text-base text-slate-300 md:text-lg">
              Établissements, familles ou professionnels : nos équipes vous
              répondent sous 2h ouvrables.
            </p>
          </div>

          <section className="mt-12">
            <ContactSection />
          </section>

          <section className="mt-16">
            <div className="text-center">
              <h2 className="font-heading text-2xl font-bold text-white md:text-3xl">
                Contact direct
              </h2>
              <p className="mt-2 text-slate-300">
                Besoin d’une réponse immédiate ? Choisissez votre canal.
              </p>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition hover:border-gold-500/40">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <MessageCircle className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-white">Discussion Instantanée</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Une réponse rapide sur WhatsApp.
                </p>
                <a
                  href="https://wa.me/21699192829"
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-emerald-400/40 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:border-emerald-300 hover:text-white"
                >
                  Ouvrir WhatsApp
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition hover:border-gold-500/40">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/10 text-gold-500">
                  <Phone className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-white">Parler à un conseiller</h3>
                <p className="mt-2 text-sm text-slate-300">Appelez-nous directement.</p>
                <a
                  href="tel:+21699192829"
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-gold-500/50 px-4 py-2 text-sm font-semibold text-gold-300 transition hover:border-gold-400 hover:text-white"
                >
                  +216 99 19 28 29
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm transition hover:border-gold-500/40">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/10 text-gold-500">
                  <MapPin className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-white">Venir au Centre</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Centre Urbain Nord, Tunis.
                </p>
                <a
                  href="#localisation"
                  className="mt-4 inline-flex items-center justify-center rounded-full border border-gold-500/50 px-4 py-2 text-sm font-semibold text-gold-300 transition hover:border-gold-400 hover:text-white"
                >
                  Voir sur la carte
                </a>
              </div>
            </div>
          </section>

          <section id="localisation" className="mt-16 scroll-mt-24">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <h3 className="text-2xl font-semibold text-white">Nous trouver</h3>
                <p className="mt-2 text-slate-300">
                  Centre Urbain Nord, Immeuble VENUS, Apt. C13, 1082 – Tunis
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-300">
                  <div>
                    <span className="font-semibold text-white">Horaires :</span> Lun-Sam : 09h-20h
                  </div>
                  <div>
                    <span className="font-semibold text-white">Téléphone :</span> +216 99 19 28 29
                  </div>
                  <div>
                    <span className="font-semibold text-white">Email :</span> contact@nexusreussite.academy
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm">
                <iframe
                  title="Nexus Réussite - Centre Urbain Nord"
                  src="https://www.google.com/maps?q=Centre%20Urbain%20Nord%2C%20Immeuble%20VENUS%2C%20Apt.%20C13%2C%201082%20Tunis&output=embed"
                  className="h-[320px] w-full border-0"
                  loading="lazy"
                />
              </div>
            </div>
          </section>

          <section className="mt-16">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
              <h3 className="text-2xl font-semibold text-white">FAQ rapide</h3>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <div>
                  <h4 className="text-lg font-semibold text-white">Quels sont vos tarifs ?</h4>
                  <p className="mt-2 text-sm text-slate-300">
                    Consultez nos offres claires et tout‑inclus.
                  </p>
                  <a href="/offres" className="mt-2 inline-flex text-sm font-semibold text-gold-400 hover:text-white">
                    Voir les offres
                  </a>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white">Où se déroulent les cours ?</h4>
                  <p className="mt-2 text-sm text-slate-300">
                    En ligne ou dans notre centre au Centre Urbain Nord.
                  </p>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white">Comment s’inscrire ?</h4>
                  <p className="mt-2 text-sm text-slate-300">
                    Commencez par un bilan gratuit via le formulaire.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
