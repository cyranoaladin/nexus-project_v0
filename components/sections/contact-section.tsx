"use client";

import React, { useState } from "react";
import { Building2, Users, Briefcase, Phone, Mail, MapPin } from "lucide-react";

type TabKey = "schools" | "families" | "pros";

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "schools", label: "Établissements", icon: Building2 },
  { key: "families", label: "Parents & Élèves", icon: Users },
  { key: "pros", label: "Formation Pro", icon: Briefcase },
];

const CTA_LABELS: Record<TabKey, string> = {
  schools: "Demander ma Démo",
  families: "Être rappelé",
  pros: "Recevoir le programme",
};

export default function ContactSection() {
  const [active, setActive] = useState<TabKey>("schools");

  return (
    <section id="contact" className="bg-midnight-950 py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-200 backdrop-blur-md">
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-gold-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-midnight-800/30 blur-3xl" />
            <div className="relative space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Nous contacter</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Choisissez votre profil et obtenez un accompagnement immédiat.
                </p>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-gold-400" />
                  <span>+216 99 19 28 29</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-gold-400" />
                  <span>contact@nexusreussite.academy</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-gold-400 mt-0.5" />
                  <div>
                    <div>Centre Urbain Nord</div>
                    <div>Immeuble VENUS, Apt. C13</div>
                    <div>1082 – Tunis</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs text-slate-300">
                Réseau d’excellence éducative & technologique
              </div>
            </div>
          </aside>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md md:p-10">
            <div className="flex flex-wrap gap-3">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.key === active;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActive(tab.key)}
                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "border-gold-500 bg-gold-500/10 text-gold-400"
                        : "border-white/10 bg-black/20 text-slate-300 hover:border-gold-500/40"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              {active === "schools" && (
                <>
                  <h2 className="text-2xl font-bold text-white font-serif">
                    Transformez votre établissement.
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Une approche stratégique pour des résultats mesurables.
                  </p>
                </>
              )}
              {active === "families" && (
                <>
                  <h2 className="text-2xl font-bold text-white font-serif">
                    L&apos;excellence scolaire commence ici.
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Un accompagnement personnalisé pour chaque élève.
                  </p>
                  <a
                    href="/famille"
                    className="mt-4 inline-flex items-center text-sm font-semibold text-gold-400 hover:text-white transition"
                  >
                    Voir le détail des offres →
                  </a>
                </>
              )}
              {active === "pros" && (
                <>
                  <h2 className="text-2xl font-bold text-white font-serif">
                    Boostez votre carrière Tech.
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Des programmes intensifs pour monter en compétence vite.
                  </p>
                </>
              )}
            </div>

            <form className="mt-8 grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">
                    Email
                  </label>
                  <input
                    type="email"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                    placeholder="email@exemple.com"
                  />
                </div>
              </div>

              {active === "schools" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Nom de l&apos;établissement
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                      placeholder="Lycée / École"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Fonction
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                      placeholder="Direction, DSI, Responsable..."
                    />
                  </div>
                </div>
              )}

              {active === "families" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Classe de l&apos;élève
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                      placeholder="Terminale, Première..."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Lycée
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                      placeholder="Nom du lycée"
                    />
                  </div>
                </div>
              )}

              {active === "families" && (
                <div>
                  <a
                    href="/offres"
                    className="text-sm font-semibold text-gold-400 hover:text-gold-300"
                  >
                    Voir le détail des offres
                  </a>
                </div>
              )}

              {active === "pros" && (
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">
                    Niveau technique actuel
                  </label>
                  <input
                    type="text"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                    placeholder="Débutant, Intermédiaire, Avancé"
                  />
                </div>
              )}

              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">
                  {active === "schools"
                    ? "Je souhaite"
                    : active === "families"
                    ? "Je cherche"
                    : "Programme"}
                </label>
                <select className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white focus:border-gold-500 focus:outline-none">
                  {active === "schools" && (
                    <>
                      <option>Nexus Digital Campus (LMS & pilotage)</option>
                      <option>Réserver une démo Korrigo</option>
                      <option>Activer ARIA (tuteur IA & suivi)</option>
                      <option>Studio IA / Agents autonomes</option>
                      <option>IA sécurisée avec vos données</option>
                      <option>Audit Stratégique & Digital (360°)</option>
                      <option>Déploiement Dashboard & pilotage</option>
                      <option>Certification sécurisée des diplômes</option>
                      <option>Formation des équipes (IA & Web3)</option>
                      <option>Autre besoin</option>
                    </>
                  )}
                  {active === "families" && (
                    <>
                      <option>Programme Odyssée (annuel)</option>
                      <option>Académies Nexus (stages intensifs)</option>
                      <option>Studio Flex (cours à la carte)</option>
                      <option>Nexus Cortex (tuteur IA 24/7)</option>
                      <option>Soutien cycle Terminal (Maths/NSI)</option>
                      <option>Coaching Orientation & Grand Oral</option>
                      <option>Découvrir ARIA (tuteur IA)</option>
                      <option>Autre besoin</option>
                    </>
                  )}
                  {active === "pros" && (
                    <>
                      <option>Bootcamp Développement Blockchain</option>
                      <option>Masterclass Assistants Intelligents</option>
                      <option>Nexus Labs (marque blanche)</option>
                      <option>Atelier IA sécurisée avec vos données</option>
                      <option>Studio IA / Agents autonomes</option>
                      <option>Audit & conseil tech</option>
                      <option>Autre besoin</option>
                    </>
                  )}
                </select>
                <p className="mt-2 text-xs text-slate-400">
                  Offre 360° : conseil, IA, formation et accompagnement sur-mesure.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">
                  Message (optionnel)
                </label>
                <textarea
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-gold-500 focus:outline-none"
                  rows={4}
                  placeholder="Décrivez brièvement votre besoin"
                />
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-gold-500 px-8 text-sm font-bold text-black transition hover:bg-gold-400"
              >
                {CTA_LABELS[active]}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
