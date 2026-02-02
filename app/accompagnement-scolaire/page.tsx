"use client";

import React from "react";
import Link from "next/link";
import {
  Award,
  Bot,
  Check,
  ChevronRight,
  GraduationCap,
  LineChart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";

export default function AccompagnementScolairePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050608] via-[#0a0b0f] to-[#050608]">
      <CorporateNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link href="/" className="hover:text-cyan-400 transition-colors">
              Accueil
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-white">Accompagnement Scolaire</span>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">
                Service Principal
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-display font-bold mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-300">
                Accompagnement{" "}
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                Scolaire
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-300 mb-8 leading-relaxed">
              Des programmes sur-mesure avec des experts agrégés pour
              transformer l'angoisse du Bac en excellence académique
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  98%
                </div>
                <div className="text-sm text-gray-400">Taux de réussite</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  150+
                </div>
                <div className="text-sm text-gray-400">Mentions TB/B</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  500+
                </div>
                <div className="text-sm text-gray-400">Élèves suivis</div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-3xl font-bold text-cyan-400 mb-1">
                  24/7
                </div>
                <div className="text-sm text-gray-400">Support IA ARIA</div>
              </div>
            </div>

            {/* Quick CTA */}
            <Link
              href="#programmes"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:scale-105 transition-transform"
            >
              Découvrir nos programmes
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Programmes Section */}
      <section id="programmes" className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Nos Programmes d'Accompagnement
            </h2>
            <p className="text-xl text-gray-400">
              Choisissez la formule adaptée à votre profil et vos objectifs
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Programme Excellence */}
            <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-cyan-500/50 transition-all">
              {/* Badge Popular */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                  <Star className="w-4 h-4 fill-current" />
                  PLUS POPULAIRE
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <GraduationCap className="w-8 h-8 text-cyan-400" />
                  <h3 className="text-3xl font-bold text-white">
                    Programme Excellence
                  </h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">299</span>
                    <span className="text-2xl text-gray-400">TND</span>
                    <span className="text-gray-500">/mois</span>
                  </div>
                  <p className="text-cyan-400 text-sm mt-2">
                    Idéal pour élèves scolarisés (2nde-Terminale)
                  </p>
                </div>

                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">8h/mois</strong> avec
                      experts agrégés ou certifiés
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">IA ARIA Premium</strong>{" "}
                      24/7 (correction exercices avancée)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        Dashboard parent temps réel
                      </strong>{" "}
                      (progression + présence)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        Garantie mention ou 3 mois offerts
                      </strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        Coaching Parcoursup inclus
                      </strong>{" "}
                      (pour Terminale)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        Cours en ligne ou présentiel
                      </strong>
                    </span>
                  </li>
                </ul>

                <div className="space-y-3">
                  <Link
                    href="/bilan-gratuit?programme=excellence"
                    className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white py-4 rounded-xl font-semibold hover:scale-105 transition-transform"
                  >
                    Choisir l'Excellence
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/contact"
                    className="flex items-center justify-center gap-2 w-full border border-white/20 text-white py-3 rounded-xl font-medium hover:bg-white/5 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Parler à un conseiller
                  </Link>
                </div>
              </div>
            </div>

            {/* Pack Bac Garanti */}
            <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-8 hover:border-blue-500/50 transition-all">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  100% GARANTI
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center gap-3 mb-6">
                  <Award className="w-8 h-8 text-blue-400" />
                  <h3 className="text-3xl font-bold text-white">
                    Pack Bac Garanti
                  </h3>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold text-white">1990</span>
                    <span className="text-2xl text-gray-400">TND</span>
                    <span className="text-gray-500">/an</span>
                  </div>
                  <p className="text-blue-400 text-sm mt-2">
                    Spécial candidats libres (passage du Bac en 1 an)
                  </p>
                </div>

                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        100h annuelles programme complet
                      </strong>{" "}
                      (toutes matières)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        Inscription Aix-Marseille gérée
                      </strong>{" "}
                      (académie de référence)
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        IA ARIA Premium illimitée
                      </strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">4 examens blancs</strong>{" "}
                      en conditions réelles
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        Garantie 100% Bac ou remboursé
                      </strong>
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">
                      <strong className="text-white">
                        Suivi administratif complet
                      </strong>
                    </span>
                  </li>
                </ul>

                <div className="space-y-3">
                  <Link
                    href="/bilan-gratuit?programme=bac-garanti"
                    className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-semibold hover:scale-105 transition-transform"
                  >
                    Sécuriser mon Bac
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/contact"
                    className="flex items-center justify-center gap-2 w-full border border-white/20 text-white py-3 rounded-xl font-medium hover:bg-white/5 transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Parler à un conseiller
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Comparaison */}
          <div className="mt-16 text-center">
            <Link
              href="/offres"
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors text-lg"
            >
              Voir tous les tarifs et packs complémentaires
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Garanties Section */}
      <section className="relative py-20 px-6 bg-gradient-to-b from-transparent via-cyan-950/10 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Nos Garanties
            </h2>
            <p className="text-xl text-gray-400">
              Votre réussite est notre seule métrique
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <ShieldCheck className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Satisfait ou Remboursé
              </h3>
              <p className="text-gray-400 text-sm">
                30 jours pour tester sans risque
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <Award className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Garantie Bac Obtenu
              </h3>
              <p className="text-gray-400 text-sm">
                Ou remboursement intégral (Pack Bac Garanti)
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <TrendingUp className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Garantie Mention
              </h3>
              <p className="text-gray-400 text-sm">
                Ou 3 mois offerts (Programme Excellence)
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
              <LineChart className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Garantie Progression
              </h3>
              <p className="text-gray-400 text-sm">
                +3 points de moyenne ou cours supplémentaires
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-xl text-gray-400">
              Un parcours simple en 3 étapes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative">
              <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-8">
                <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-6">
                  1
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Bilan Gratuit
                </h3>
                <p className="text-gray-300">
                  Remplissez notre formulaire pour évaluer les besoins de votre
                  enfant. Un conseiller vous contacte sous 24h pour affiner le
                  diagnostic.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-8">
                <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-6">
                  2
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Matching Expert
                </h3>
                <p className="text-gray-300">
                  Nous sélectionnons le mentor idéal selon le profil, la
                  matière et les objectifs. Vous rencontrez votre expert lors
                  d'une session découverte.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl p-8">
                <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center text-white text-2xl font-bold mb-6">
                  3
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">
                  Accompagnement Personnalisé
                </h3>
                <p className="text-gray-300">
                  Démarrage immédiat avec planning adapté, suivi en temps réel
                  sur le dashboard parent, et support IA ARIA 24/7.
                </p>
              </div>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link
              href="/bilan-gratuit"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:scale-105 transition-transform"
            >
              Commencer mon bilan gratuit
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Notre Différence */}
      <section className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
              Pourquoi Nexus Réussite ?
            </h2>
            <p className="text-xl text-gray-400">
              Ce qui nous distingue des autres
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <Users className="w-12 h-12 text-cyan-400 mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">
                Experts 100% Agrégés
              </h3>
              <p className="text-gray-300">
                Aucun étudiant, aucun amateur. Uniquement des enseignants
                agrégés ou certifiés avec 10+ ans d'expérience.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <Bot className="w-12 h-12 text-cyan-400 mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">
                IA ARIA 24/7
              </h3>
              <p className="text-gray-300">
                Un assistant IA avancé disponible en permanence pour corriger
                les exercices, préparer l'oral, et analyser les textes.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <LineChart className="w-12 h-12 text-cyan-400 mb-6" />
              <h3 className="text-2xl font-bold text-white mb-4">
                Suivi Temps Réel
              </h3>
              <p className="text-gray-300">
                Dashboard parent avec progression en direct, présence aux cours,
                et alertes automatiques.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-3xl p-12">
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
              Prêt à transformer l'angoisse du Bac en excellence ?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Rejoignez les 500+ familles qui ont fait confiance à Nexus
              Réussite
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/bilan-gratuit"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:scale-105 transition-transform"
              >
                Commencer maintenant
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 border border-white/20 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-white/5 transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
                Parler à un conseiller
              </Link>
            </div>

            <p className="text-sm text-gray-400 mt-6">
              Satisfait ou remboursé sous 30 jours • Sans engagement
            </p>
          </div>
        </div>
      </section>

      <CorporateFooter />
    </div>
  );
}
