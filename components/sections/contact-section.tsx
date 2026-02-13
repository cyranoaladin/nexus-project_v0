"use client";

import React, { useState, useEffect } from "react";
import { Building2, Users, Briefcase, Phone, Mail, MapPin } from "lucide-react";
import { track } from "@/lib/analytics";

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
  const [interest, setInterest] = useState("");
  const [urgency, setUrgency] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    setInterest("");
    setUrgency("");
  }, [active]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("loading");
    track.contactSubmit(active, interest || undefined, urgency || undefined, document.referrer || undefined);
    track.ctaClick("contact_form", CTA_LABELS[active]);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: active,
          interest,
          urgency,
          name,
          email,
          phone,
          message,
          source: document.referrer || undefined,
        }),
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      setStatus("success");
      setShowSuccess(true);
      setMessage("");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
  };

  return (
    <section id="contact" className="bg-surface-darker py-24">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-200 backdrop-blur-md">
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-brand-accent/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-neutral-800/30 blur-3xl" />
            <div className="relative space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Nous contacter</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Choisissez votre profil et obtenez un accompagnement immédiat.
                </p>
              </div>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-brand-accent" />
                  <span>+216 99 19 28 29</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-brand-accent" />
                  <span>contact@nexusreussite.academy</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-brand-accent mt-0.5" />
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
                        ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                        : "border-white/10 bg-black/20 text-slate-300 hover:border-brand-accent/40"
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
                  <h2 className="text-2xl font-bold text-white font-display">
                    Transformez votre établissement.
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Une approche stratégique pour des résultats mesurables.
                  </p>
                </>
              )}
              {active === "families" && (
                <>
                  <h2 className="text-2xl font-bold text-white font-display">
                    L&apos;excellence scolaire commence ici.
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Un accompagnement personnalisé pour chaque élève.
                  </p>
                  <a
                    href="/famille"
                    className="mt-4 inline-flex items-center text-sm font-semibold text-brand-accent hover:text-white transition"
                  >
                    Voir le détail des offres →
                  </a>
                </>
              )}
              {active === "pros" && (
                <>
                  <h2 className="text-2xl font-bold text-white font-display">
                    Boostez votre carrière Tech.
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Des programmes intensifs pour monter en compétence vite.
                  </p>
                </>
              )}
            </div>

            <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                    placeholder="Votre nom"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-slate-400">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                    placeholder="email@exemple.com"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                  placeholder="+216 ..."
                />
              </div>

              {active === "schools" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Nom de l&apos;établissement
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      placeholder="Lycée / École"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Fonction
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      placeholder="Direction, DSI, Responsable..."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Taille de l&apos;établissement
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      value={urgency}
                      onChange={(event) => setUrgency(event.target.value)}
                    >
                      <option value="">Sélectionner</option>
                      <option value="moins-300">Moins de 300 élèves</option>
                      <option value="300-800">300 à 800 élèves</option>
                      <option value="plus-800">Plus de 800 élèves</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Priorité
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      value={interest}
                      onChange={(event) => setInterest(event.target.value)}
                    >
                      <option value="">Sélectionner</option>
                      <option value="demo">Démo plateforme</option>
                      <option value="audit">Audit & diagnostic</option>
                      <option value="ia">IA & automatisation</option>
                      <option value="formation">Formation des équipes</option>
                    </select>
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
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      placeholder="Terminale, Première..."
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Lycée
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      placeholder="Nom du lycée"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Objectif principal
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      value={interest}
                      onChange={(event) => setInterest(event.target.value)}
                    >
                      <option value="">Sélectionner</option>
                      <option value="bac">Réussir le Bac</option>
                      <option value="mention">Viser une mention</option>
                      <option value="parcoursup">Parcoursup & orientation</option>
                      <option value="remise-a-niveau">Remise à niveau</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Délai de démarrage
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      value={urgency}
                      onChange={(event) => setUrgency(event.target.value)}
                    >
                      <option value="">Sélectionner</option>
                      <option value="urgent">Cette semaine</option>
                      <option value="2-4sem">Dans 2 à 4 semaines</option>
                      <option value="plus">Plus tard</option>
                    </select>
                  </div>
                </div>
              )}

              {active === "families" && (
                <div>
                  <a
                    href="/offres"
                    className="text-sm font-semibold text-brand-accent hover:text-brand-accent/80"
                  >
                    Voir le détail des offres
                  </a>
                </div>
              )}

              {active === "pros" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Niveau technique actuel
                    </label>
                    <input
                      type="text"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      placeholder="Débutant, Intermédiaire, Avancé"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Objectif
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      value={interest}
                      onChange={(event) => setInterest(event.target.value)}
                    >
                      <option value="">Sélectionner</option>
                      <option value="ia">IA & automatisation</option>
                      <option value="web3">Web3 & blockchain</option>
                      <option value="reconversion">Reconversion</option>
                      <option value="upskill">Upskilling équipe</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-slate-400">
                      Délai de démarrage
                    </label>
                    <select
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                      value={urgency}
                      onChange={(event) => setUrgency(event.target.value)}
                    >
                      <option value="">Sélectionner</option>
                      <option value="urgent">Ce mois‑ci</option>
                      <option value="next">Le mois prochain</option>
                      <option value="later">Plus tard</option>
                    </select>
                  </div>
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
                <select className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none">
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
                  Réponse sous 2h ouvrables. Vos informations restent confidentielles.
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-slate-400">
                  Message (optionnel)
                </label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-brand-accent/60 focus:ring-1 focus:ring-brand-accent/30 focus:outline-none"
                  rows={4}
                  placeholder="Décrivez brièvement votre besoin"
                />
              </div>

              <button
                type="submit"
                className="mt-2 btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={status === "loading"}
              >
                {status === "loading" ? "Envoi..." : CTA_LABELS[active]}
              </button>
              {status === "success" && (
                <div className="text-sm text-emerald-300">
                  Merci, votre demande a bien été envoyée.
                </div>
              )}
              {status === "error" && (
                <div className="text-sm text-red-300">
                  Une erreur est survenue. Merci de réessayer ou d’appeler directement.
                </div>
              )}
              <p className="text-xs text-slate-400">
                En soumettant ce formulaire, vous acceptez d’être recontacté par un conseiller.
              </p>
            </form>
          </div>
        </div>
      </div>
      {showSuccess && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-surface-card p-8 text-center shadow-2xl">
            <h3 className="text-2xl font-bold text-white font-display">
              Merci, votre demande est envoyée
            </h3>
            <p className="mt-3 text-sm text-slate-300">
              Un conseiller vous recontacte sous 2h ouvrables. Vous pouvez déjà préparer votre bilan.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <a
                href="/bilan-gratuit"
                className="btn-primary"
              >
                Démarrer un bilan gratuit
              </a>
              <button
                type="button"
                onClick={() => setShowSuccess(false)}
                className="btn-outline"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
