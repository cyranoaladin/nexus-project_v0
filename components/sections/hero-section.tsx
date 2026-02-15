"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Award, BrainCircuit, Code2, HelpCircle, Network, ShieldCheck, Sparkles, Users, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

// Composant Tooltip pour DIU NSI
function DIUTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-blue-600 hover:text-blue-700 transition-colors"
      >
        <HelpCircle size={16} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-80 text-left">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-slate-900 text-sm">
                Qu'est-ce que le DIU NSI ?
              </h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 ml-2"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Le DIU "Enseigner l'informatique au lycée" est un diplôme national qui garantit
              que l'enseignant possède les connaissances et les compétences pédagogiques requises
              pour enseigner la spécialité Numérique et Sciences Informatiques (NSI) en 1ère et
              Terminale, conformément aux exigences de la réforme du lycée.
            </p>
            {/* Flèche du tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-200 -mt-1"></div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
export function HeroSection() {
  return (
    <section className="relative overflow-hidden min-h-screen flex items-center">
      {/* Image d'arrière-plan */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/hero-image.png')",
          backgroundSize: "cover",
          backgroundPosition: "center center",
          backgroundRepeat: "no-repeat"
        }}
      >
        {/* Overlay sombre pour la lisibilité */}
        <div className="absolute inset-0 bg-black/40"></div>

        {/* Dégradé additionnel du centre vers les bords */}
        <div className="absolute inset-0 bg-gradient-radial from-blue-900/20 via-blue-900/40 to-black/60"></div>

        {/* Motif de grille technologique très subtil */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="tech-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="var(--color-brand-primary)" />
                <path d="M 0 20 L 40 20 M 20 0 L 20 40" stroke="var(--color-brand-primary)" strokeWidth="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#tech-grid)" />
          </svg>
        </div>
      </div>

      {/* Contenu principal centré full-width */}
      <div className="relative w-full max-w-6xl mx-auto px-4 py-12 md:py-20 text-center">

        {/* Badge d'introduction */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center mb-6 md:mb-8"
        >
          <Badge className="badge-popular marketing-badge normal-case">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5 mr-2" />
            Pédagogie Augmentée par l'IA
          </Badge>
        </motion.div>

        {/* Titre H1 - Directive Finale CTO : Narrative Émotionnelle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >

          <h1 className="marketing-hero-title font-heading lg:text-8xl mb-8 leading-tight drop-shadow-2xl">
            <span className="block text-white">La <span className="text-blue-300">Pédagogie Augmentée</span></span>
            <span className="block text-white">pour Réussir son Bac.</span>
            <span className="block text-white font-medium text-4xl md:text-5xl lg:text-6xl">Sans Stress.</span>

          </h1>
        </motion.div>

        {/* Logo Slogan centré avec dimensions réduites */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex justify-center mb-6 md:mb-8"
        >
          <Image
            src="/images/logo_slogan_nexus_x3.png"
            alt="Nexus Réussite - Engagement Qualité"
            width={1200}
            height={432}
            className="w-auto h-auto max-w-full md:max-w-4xl opacity-90"
            priority
          />
        </motion.div>

        {/* Sous-titre - Directive Finale CTO : Focus sur l'Expertise et les Résultats */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}

          className="marketing-hero-copy mb-12 max-w-4xl mx-auto text-white/90 drop-shadow-lg"

        >
          Nous fusionnons l'expertise de <span className="text-blue-300 font-semibold">professeurs d'élite de l'enseignement français</span> avec la puissance de notre <span className="text-blue-300 font-semibold">plateforme intelligente ARIA</span>. L'objectif : transformer le potentiel de votre enfant en une <span className="text-blue-300 font-semibold">mention au Bac</span> et un <span className="text-blue-300 font-semibold">avenir choisi sur Parcoursup</span>.
        </motion.p>

        {/* Grille de fonctionnalités centrée */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-8 md:mb-12 max-w-4xl mx-auto"
        >
          <div className="flex flex-col items-center gap-2 md:gap-3 p-3 md:p-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-soft">
            <ShieldCheck className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            <p className="text-slate-900 font-medium text-center text-xs md:text-sm">
              Coachs <span className="text-blue-600 font-semibold">Agrégés et Certifiés</span>
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 md:gap-3 p-3 md:p-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-soft">
            <BrainCircuit className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            <p className="text-slate-900 font-medium text-center text-xs md:text-sm">
              <span className="text-blue-600 font-semibold">IA ARIA</span> 24/7
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 p-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-soft">
            <Network className="w-8 h-8 text-blue-600" />
            <p className="text-slate-900 font-medium text-center">Expertise <span className="text-blue-600 font-semibold">Enseignement Français</span></p>

          </div>
          <div className="flex flex-col items-center gap-2 md:gap-3 p-3 md:p-6 bg-white/90 backdrop-blur-sm rounded-xl shadow-soft">
            <Code2 className="w-6 h-6 md:w-8 md:h-8 text-blue-600" />
            <p className="text-slate-900 font-medium text-center text-xs md:text-sm">
              Spécialistes <span className="text-blue-600 font-semibold">DIU NSI</span><DIUTooltip />
            </p>
          </div>
        </motion.div>

        {/* Boutons CTA centrés - Directive CTO : Modale pour réduire friction */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center mb-6 md:mb-8"
        >
          <Button
            onClick={() => {
              // TODO: Ouvrir modale bilan gratuit directement
              window.location.href = '/bilan-gratuit';
            }}
            size="lg"
            className="h-12 md:h-16 px-6 md:px-10 text-base md:text-lg group inline-flex items-center justify-center"
          >
            Commencer mon Bilan Stratégique Gratuit
            <ArrowRight className="ml-2 md:ml-3 h-4 w-4 md:h-5 md:w-5 transition-transform group-hover:translate-x-1" />
          </Button>
          <Link href="/offres">
            <Button variant="outline" size="lg" className="h-12 md:h-16 px-6 md:px-10 text-base md:text-lg">
              Découvrir nos Offres
            </Button>
          </Link>
        </motion.div>

        {/* Preuve Sociale basée sur l'Expertise - Notre Force : L'Excellence de nos Experts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 md:p-6 shadow-medium max-w-4xl mx-auto">
            <h3 className="text-slate-800 font-bold text-base md:text-lg mb-4 md:mb-6">Notre Force : L'Excellence de nos Experts</h3>
            <div className="grid grid-cols-3 gap-4 md:gap-6">
              <div className="flex flex-col items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Award className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg md:text-2xl font-bold text-slate-900">+150</p>
                  <p className="text-xs md:text-sm text-slate-600">Années d'Expérience Cumulée</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Users className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg md:text-2xl font-bold text-slate-900">Des Centaines</p>
                  <p className="text-xs md:text-sm text-slate-600">d'Élèves Accompagnés</p>
                </div>
              </div>
              <div className="flex flex-col items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 md:w-6 md:h-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg md:text-2xl font-bold text-slate-900">100%</p>
                  <p className="text-xs md:text-sm text-slate-600">de nos coachs sont Agrégés et Certifiés</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
