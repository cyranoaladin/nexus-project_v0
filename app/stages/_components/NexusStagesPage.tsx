"use client";

import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock3,
  CreditCard,
  GraduationCap,
  Mic,
  BookOpen,
  Brain,
  Laptop,
  FlaskConical,
  Star,
  ChevronDown,
  CheckCircle2,
  Sparkles,
  Users,
  BadgeCheck,
  ArrowRight,
  Search,
  Check,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Info,
  Table as TableIcon,
  ChevronUp,
  Download,
  Heart,
  Menu,
  X,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";

// ============================================
// DATA
// ============================================

const scheduleWindows = [
  {
    title: "Période des stages",
    value: "18 avril → 2 mai",
    icon: CalendarDays,
    note: "Hors dimanches — groupes lancés selon constitution effective.",
    color: "from-cyan-500 to-blue-500",
    bgColor: "bg-cyan-500/10",
    iconColor: "text-cyan-400",
  },
  {
    title: "Réservation",
    value: "50 % à l'inscription",
    icon: CreditCard,
    note: "Le solde est complété avant le démarrage.",
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-400",
  },
  {
    title: "Effectif",
    value: "2 à 6 élèves",
    icon: Users,
    note: "Selon la formule et le seuil d'ouverture retenu.",
    color: "from-violet-500 to-fuchsia-500",
    bgColor: "bg-violet-500/10",
    iconColor: "text-violet-400",
  },
];

const whiteExamSlots = {
  premiere: [
    { title: "Français écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", color: "bg-blue-500/10 text-blue-300 border-blue-500/25", subject: "Français", type: "Écrit" },
    { title: "Maths écrit blanc", date: "Mercredi 29 avril", time: "09h00 – 12h00", color: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25", subject: "Maths", type: "Écrit" },
    { title: "Français oral blanc", date: "Jeudi 30 avril", time: "13h30 – 16h30", color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/25", subject: "Français", type: "Oral" },
  ],
  terminale: [
    { title: "NSI écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", color: "bg-violet-500/10 text-violet-300 border-violet-500/25", subject: "NSI", type: "Écrit" },
    { title: "Physique-Chimie écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", color: "bg-pink-500/10 text-pink-300 border-pink-500/25", subject: "Physique-Chimie", type: "Écrit" },
    { title: "Maths écrit blanc", date: "Mercredi 29 avril", time: "09h00 – 12h00", color: "bg-rose-500/10 text-rose-300 border-rose-500/25", subject: "Maths", type: "Écrit" },
    { title: "NSI pratique blanche", date: "Jeudi 30 avril", time: "09h00 – 12h00", color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", subject: "NSI", type: "Pratique" },
    { title: "Ateliers Grand Oral", date: "28 avril / 30 avril / 2 mai", time: "17h00 – 19h00", color: "bg-amber-500/10 text-amber-300 border-amber-500/25", subject: "Grand Oral", type: "Atelier" },
  ],
};

const offers = [
  {
    id: "p-maths",
    level: "premiere",
    category: "mono",
    subjectKey: "maths",
    title: "Maths Première — Nouvelle épreuve 2026",
    badge: "Mono-matière",
    hours: 15,
    price: 539,
    oldPrice: null,
    featured: true,
    color: "from-cyan-500 to-blue-500",
    bgGradient: "from-cyan-500/[0.12] via-blue-500/[0.06] to-transparent",
    icon: Brain,
    threshold: "Ouverture à partir de 2 élèves",
    shortPitch: "Une préparation méthodique pour l'épreuve anticipée de mathématiques.",
    points: ["5 blocs de 3h sur 2 semaines", "Entraînement progressif sans calculatrice", "Épreuve blanche intégrée", "Correction stratégique et plan final"],
    bonus: null,
    planning: ["Samedi 18 avril — 09h00 à 12h00 · Bloc 1 : diagnostic", "Lundi 20 avril — 09h00 à 12h00 · Bloc 2 : fonctions", "Jeudi 23 avril — 09h00 à 12h00 · Bloc 3 : probabilités", "Samedi 25 avril — 09h00 à 12h00 · Bloc 4 : suites", "Mercredi 29 avril — 09h00 à 11h00 · Épreuve blanche", "Mercredi 29 avril — 11h00 à 12h00 · Correction"],
    followUp: ["Corrigé détaillé de l'épreuve blanche", "Bilan intermédiaire transmis à la famille", "Bilan final individualisé", "Plan de révision ciblé"],
  },
  {
    id: "p-fr",
    level: "premiere",
    category: "mono",
    subjectKey: "francais",
    title: "Français Première — Sprint EAF",
    badge: "Écrit + Oral",
    hours: 12,
    price: 649,
    oldPrice: null,
    featured: false,
    color: "from-blue-500 to-indigo-500",
    bgGradient: "from-blue-500/[0.12] via-indigo-500/[0.06] to-transparent",
    icon: BookOpen,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Une préparation ciblée pour l'écrit et l'oral du Français.",
    points: ["4 blocs de 3h sur 2 semaines", "Écrit blanc de Français inclus", "Oral blanc de Français inclus", "Plan de révision final structuré"],
    bonus: null,
    planning: ["Mardi 21 avril — 13h30 à 16h30 · Bloc 1 : méthode", "Lundi 27 avril — 13h30 à 16h30 · Bloc 2 : oral", "Mardi 28 avril — 09h00 à 12h00 · Écrit blanc", "Jeudi 30 avril — 13h30 à 16h30 · Oral blanc"],
    followUp: ["Corrigé commenté de l'écrit blanc", "Retour individualisé sur l'oral", "Bilan intermédiaire transmis à la famille", "Bilan final et plan de révision"],
  },
  {
    id: "p-nsi",
    level: "premiere",
    category: "mono",
    subjectKey: "nsi",
    title: "NSI Première",
    badge: "Mono-matière",
    hours: 15,
    price: 509,
    oldPrice: null,
    featured: false,
    color: "from-violet-500 to-fuchsia-500",
    bgGradient: "from-violet-500/[0.12] via-fuchsia-500/[0.06] to-transparent",
    icon: Laptop,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Consolider les bases utiles et gagner en méthode.",
    points: ["5 blocs de 3h sur 2 semaines", "Python, structures, algorithmique", "Sujet de synthèse intégré", "Plan de consolidation personnalisé"],
    bonus: null,
    planning: ["Mercredi 22 avril — 09h00 à 12h00 · Bloc 1 : Python", "Vendredi 24 avril — 09h00 à 12h00 · Bloc 2 : structures", "Lundi 27 avril — 09h00 à 12h00 · Bloc 3 : algorithmique", "Vendredi 1er mai — 09h00 à 12h00 · Bloc 4 : sujet guidé", "Samedi 2 mai — 09h00 à 12h00 · Bloc 5 : consolidation"],
    followUp: ["Sujet de synthèse corrigé", "Retour individualisé", "Bilan intermédiaire transmis à la famille", "Bilan final transmis"],
  },
  {
    id: "p-duo-fr-maths",
    level: "premiere",
    category: "duo",
    subjectKey: "duo-fr-maths",
    title: "Duo Première — Français + Maths",
    badge: "Best-seller",
    hours: 30,
    price: 1149,
    oldPrice: 1188,
    featured: true,
    color: "from-amber-500 to-orange-500",
    bgGradient: "from-amber-500/[0.15] via-orange-500/[0.08] to-transparent",
    icon: Star,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Les deux épreuves anticipées dans une seule formule cohérente.",
    points: ["Maths 18h + Français 12h", "Écrit blanc de Français inclus", "Écrit blanc de Maths inclus", "Oral blanc de Français inclus"],
    bonus: { title: "Accès Masterium offert", subtitle: "Préparation à l'épreuve anticipée de Français", value: "Valeur réelle : 258 TND" },
    planning: ["Samedi 18 avril — Maths bloc 1", "Lundi 20 avril — Maths bloc 2", "Mardi 21 avril — Français bloc 1", "Jeudi 23 avril — Maths bloc 3", "Samedi 25 avril — Maths bloc 4", "Lundi 27 avril — Français bloc 2", "Mardi 28 avril — Français écrit blanc", "Mercredi 29 avril — Maths écrit blanc + correction", "Jeudi 30 avril — Français oral blanc", "Samedi 2 mai — Maths consolidation"],
    followUp: ["Point d'étape intermédiaire", "Corrigés détaillés des épreuves blanches", "Bilan final avec priorités"],
  },
  {
    id: "p-duo-maths-nsi",
    level: "premiere",
    category: "duo",
    subjectKey: "duo-maths-nsi",
    title: "Duo Première — Maths + NSI",
    badge: "Parcours scientifique",
    hours: 30,
    price: 1009,
    oldPrice: 1048,
    featured: true,
    color: "from-emerald-500 to-cyan-500",
    bgGradient: "from-emerald-500/[0.15] via-cyan-500/[0.08] to-transparent",
    icon: Sparkles,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Un parcours cohérent pour travailler deux matières stratégiques.",
    points: ["Maths 15h + NSI 15h", "Écrit blanc de Maths inclus", "Sujet de synthèse NSI intégré", "Progression structurée"],
    bonus: { title: "Accès Masterium offert", subtitle: "Préparation à l'épreuve anticipée de Français", value: "Valeur réelle : 258 TND" },
    planning: ["Samedi 18 avril — Maths bloc 1", "Lundi 20 avril — Maths bloc 2", "Mercredi 22 avril — NSI bloc 1", "Jeudi 23 avril — Maths bloc 3", "Vendredi 24 avril — NSI bloc 2", "Samedi 25 avril — Maths bloc 4", "Lundi 27 avril — NSI bloc 3", "Mercredi 29 avril — Maths écrit blanc + correction", "Vendredi 1er mai — NSI bloc 4", "Samedi 2 mai — NSI bloc 5"],
    followUp: ["Point d'étape intermédiaire", "Corrigé détaillé Maths + retour NSI", "Bilan final sur les deux matières"],
  },
  {
    id: "p-trio",
    level: "premiere",
    category: "parcours",
    subjectKey: "trio",
    title: "Trio Première — Français + Maths + NSI",
    badge: "Formule complète",
    hours: 36,
    price: 1609,
    oldPrice: 1697,
    featured: false,
    color: "from-fuchsia-500 to-indigo-500",
    bgGradient: "from-fuchsia-500/[0.15] via-indigo-500/[0.08] to-transparent",
    icon: GraduationCap,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Une préparation globale et structurée sur l'ensemble des priorités.",
    points: ["Maths 18h + Français 12h + NSI 6h", "Écrits blancs inclus", "Oral blanc de Français inclus", "Vision claire des priorités"],
    bonus: { title: "Accès Masterium offert", subtitle: "Préparation à l'épreuve anticipée de Français", value: "Valeur réelle : 258 TND" },
    planning: ["Samedi 18 avril — Maths bloc 1", "Lundi 20 avril — Maths bloc 2", "Mardi 21 avril — Français bloc 1", "Mercredi 22 avril — NSI bloc 1", "Jeudi 23 avril — Maths bloc 3", "Vendredi 24 avril — NSI bloc 2", "Samedi 25 avril — Maths bloc 4", "Lundi 27 avril — Français bloc 2", "Mardi 28 avril — Français écrit blanc", "Mercredi 29 avril — Maths écrit blanc + correction", "Jeudi 30 avril — Français oral blanc", "Samedi 2 mai — Maths consolidation"],
    followUp: ["Point d'étape intermédiaire", "Corrigés détaillés des épreuves blanches", "Bilan final multi-matières"],
  },
  {
    id: "t-maths",
    level: "terminale",
    category: "mono",
    subjectKey: "maths",
    title: "Maths Terminale",
    badge: "Bac écrit",
    hours: 18,
    price: 719,
    oldPrice: null,
    featured: true,
    color: "from-rose-500 to-orange-500",
    bgGradient: "from-rose-500/[0.12] via-orange-500/[0.06] to-transparent",
    icon: Brain,
    threshold: "Ouverture à partir de 2 élèves",
    shortPitch: "Consolider l'épreuve écrite avec méthode et rigueur.",
    points: ["6 blocs de 3h", "Écrit blanc intégré", "Correction stratégique finale", "Travail de méthode et de vitesse"],
    bonus: null,
    planning: ["Samedi 18 avril — 13h30 à 16h30 · Bloc 1 : diagnostic", "Lundi 20 avril — 13h30 à 16h30 · Bloc 2 : fonctions", "Samedi 25 avril — 13h30 à 16h30 · Bloc 3 : probabilités", "Mardi 28 avril — 13h30 à 16h30 · Bloc 4 : entraînement", "Mercredi 29 avril — 09h00 à 12h00 · Épreuve blanche", "Samedi 2 mai — 13h30 à 16h30 · Correction finale"],
    followUp: ["Corrigé détaillé de l'épreuve blanche", "Bilan intermédiaire transmis à la famille", "Bilan final individualisé", "Conseils de méthode"],
  },
  {
    id: "t-nsi",
    level: "terminale",
    category: "mono",
    subjectKey: "nsi",
    title: "NSI Terminale — Écrit + Pratique",
    badge: "Spécialité",
    hours: 12,
    price: 609,
    oldPrice: null,
    featured: false,
    color: "from-violet-500 to-purple-500",
    bgGradient: "from-violet-500/[0.12] via-purple-500/[0.06] to-transparent",
    icon: Laptop,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Travailler l'écrit et la pratique dans une même logique.",
    points: ["Écrit blanc NSI intégré", "Pratique blanche NSI intégrée", "Débrief technique", "Méthode claire"],
    bonus: null,
    planning: ["Mardi 21 avril — 09h00 à 12h00 · Bloc 1 : données, SQL", "Jeudi 23 avril — 13h30 à 16h30 · Bloc 2 : algorithmique", "Mardi 28 avril — 09h00 à 12h00 · Écrit blanc NSI", "Jeudi 30 avril — 09h00 à 10h00 · Pratique blanche", "Jeudi 30 avril — 10h00 à 12h00 · Débrief"],
    followUp: ["Corrigé détaillé écrit + retour pratique", "Analyse personnalisée", "Bilan intermédiaire transmis à la famille", "Bilan final transmis"],
  },
  {
    id: "t-physique",
    level: "terminale",
    category: "mono",
    subjectKey: "physique",
    title: "Physique-Chimie Terminale",
    badge: "Spécialité",
    hours: 12,
    price: 609,
    oldPrice: null,
    featured: false,
    color: "from-emerald-500 to-teal-500",
    bgGradient: "from-emerald-500/[0.12] via-teal-500/[0.06] to-transparent",
    icon: FlaskConical,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Révisions ciblées et entraînement en Physique-Chimie.",
    points: ["Écrit blanc intégré", "Correction et consolidation", "Travail méthodique", "Cadre structuré"],
    bonus: null,
    planning: ["Mardi 21 avril — 13h30 à 16h30 · Bloc 1 : méthode", "Vendredi 24 avril — 13h30 à 16h30 · Bloc 2 : spécialité", "Mardi 28 avril — 09h00 à 12h00 · Écrit blanc", "Vendredi 1er mai — 13h30 à 16h30 · Correction finale"],
    followUp: ["Corrigé détaillé individualisé", "Bilan intermédiaire transmis à la famille", "Bilan final avec axes de progrès", "Conseils de méthode"],
  },
  {
    id: "t-go",
    level: "terminale",
    category: "mono",
    subjectKey: "grand-oral",
    title: "Grand Oral — Module complémentaire",
    badge: "Add-on",
    hours: 4,
    price: 209,
    oldPrice: null,
    featured: false,
    color: "from-amber-500 to-yellow-500",
    bgGradient: "from-amber-500/[0.12] via-yellow-500/[0.06] to-transparent",
    icon: Mic,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Structurer sa prise de parole et gagner en clarté.",
    points: ["2 ateliers de 2h", "Construction des questions", "Préparation de l'exposé", "Feedback ciblé"],
    bonus: null,
    planning: ["Mardi 28 avril — 17h00 à 19h00 · Atelier 1 : questions", "Jeudi 30 avril — 17h00 à 19h00 · Atelier 2 : exposé"],
    followUp: ["Retour individualisé structure + posture", "Bilan intermédiaire transmis à la famille", "Conseils personnalisés"],
  },
  {
    id: "t-pack-maths-nsi",
    level: "terminale",
    category: "duo",
    subjectKey: "pack-maths-nsi",
    title: "Pack Terminale — Maths + NSI",
    badge: "Parcours numérique",
    hours: 30,
    price: 1279,
    oldPrice: 1328,
    featured: true,
    color: "from-emerald-500 to-cyan-500",
    bgGradient: "from-emerald-500/[0.15] via-cyan-500/[0.08] to-transparent",
    icon: Star,
    threshold: "Ouverture à partir de 2 élèves",
    shortPitch: "Une formule structurante pour deux piliers majeurs.",
    points: ["Maths 18h + NSI 12h", "Écrits blancs inclus", "Pratique blanche NSI", "Progression cohérente"],
    bonus: { title: "3 ateliers Grand Oral offerts", subtitle: "Préparation orale en complément", value: "Valeur réelle : 300 TND" },
    planning: ["Samedi 18 avril — Maths bloc 1", "Lundi 20 avril — Maths bloc 2", "Mardi 21 avril — NSI bloc 1", "Jeudi 23 avril — NSI bloc 2", "Samedi 25 avril — Maths bloc 3", "Mardi 28 avril — NSI écrit blanc + Maths bloc 4 + GO atelier 1", "Mercredi 29 avril — Maths écrit blanc", "Jeudi 30 avril — NSI pratique + débrief + GO atelier 2", "Samedi 2 mai — Maths correction finale + GO atelier 3"],
    followUp: ["Bilan intermédiaire", "Corrigés détaillés + retour pratique", "Bilan final sur les deux matières"],
  },
  {
    id: "t-pack-maths-phys",
    level: "terminale",
    category: "duo",
    subjectKey: "pack-maths-phys",
    title: "Pack Terminale — Maths + Physique-Chimie",
    badge: "Parcours scientifique",
    hours: 30,
    price: 1279,
    oldPrice: 1328,
    featured: true,
    color: "from-orange-500 to-rose-500",
    bgGradient: "from-orange-500/[0.15] via-rose-500/[0.08] to-transparent",
    icon: Sparkles,
    threshold: "Ouverture à partir de 2 élèves",
    shortPitch: "Une ligne droite scientifique jusqu'aux écrits.",
    points: ["Maths 18h + Physique 12h", "Écrits blancs inclus", "Correction des méthodes", "Cadre premium"],
    bonus: { title: "3 ateliers Grand Oral offerts", subtitle: "Préparation orale en complément", value: "Valeur réelle : 300 TND" },
    planning: ["Samedi 18 avril — Maths bloc 1", "Lundi 20 avril — Maths bloc 2", "Mardi 21 avril — Physique bloc 1", "Vendredi 24 avril — Physique bloc 2", "Samedi 25 avril — Maths bloc 3", "Mardi 28 avril — Physique écrit blanc + Maths bloc 4 + GO atelier 1", "Mercredi 29 avril — Maths écrit blanc", "Jeudi 30 avril — GO atelier 2", "Vendredi 1er mai — Physique correction", "Samedi 2 mai — Maths correction finale + GO atelier 3"],
    followUp: ["Bilan intermédiaire", "Corrigés détaillés Maths et Physique", "Bilan final avec priorités"],
  },
  {
    id: "t-pack-maths-nsi-go",
    level: "terminale",
    category: "parcours",
    subjectKey: "pack-maths-nsi-go",
    title: "Pack Terminale — Maths + NSI + Grand Oral",
    badge: "Premium",
    hours: 36,
    price: 1449,
    oldPrice: 1537,
    featured: false,
    color: "from-indigo-500 to-fuchsia-500",
    bgGradient: "from-indigo-500/[0.15] via-fuchsia-500/[0.08] to-transparent",
    icon: GraduationCap,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Un parcours complet : écrit, pratique et oral.",
    points: ["Maths 18h + NSI 12h + Grand Oral 6h", "Écrits blancs inclus", "Pratique blanche NSI", "3 ateliers GO intégrés"],
    bonus: null,
    planning: ["Samedi 18 avril — Maths bloc 1", "Lundi 20 avril — Maths bloc 2", "Mardi 21 avril — NSI bloc 1", "Jeudi 23 avril — NSI bloc 2", "Samedi 25 avril — Maths bloc 3", "Mardi 28 avril — NSI écrit blanc + Maths bloc 4 + GO atelier 1", "Mercredi 29 avril — Maths écrit blanc", "Jeudi 30 avril — NSI pratique + débrief + GO atelier 2", "Samedi 2 mai — Maths correction finale + GO atelier 3"],
    followUp: ["Bilan intermédiaire", "Corrigés détaillés + retour pratique/oral", "Bilan final complet"],
  },
  {
    id: "t-pack-maths-phys-go",
    level: "terminale",
    category: "parcours",
    subjectKey: "pack-maths-phys-go",
    title: "Pack Terminale — Maths + Physique + Grand Oral",
    badge: "Premium",
    hours: 36,
    price: 1449,
    oldPrice: 1537,
    featured: false,
    color: "from-sky-500 to-indigo-500",
    bgGradient: "from-sky-500/[0.15] via-indigo-500/[0.08] to-transparent",
    icon: GraduationCap,
    threshold: "Ouverture à partir de 3 élèves",
    shortPitch: "Préparation complète pour l'écrit scientifique et l'oral.",
    points: ["Maths 18h + Physique 12h + Grand Oral 6h", "Écrits blancs inclus", "Correction ciblée", "3 ateliers GO intégrés"],
    bonus: null,
    planning: ["Samedi 18 avril — Maths bloc 1", "Lundi 20 avril — Maths bloc 2", "Mardi 21 avril — Physique bloc 1", "Vendredi 24 avril — Physique bloc 2", "Samedi 25 avril — Maths bloc 3", "Mardi 28 avril — Physique écrit blanc + Maths bloc 4 + GO atelier 1", "Mercredi 29 avril — Maths écrit blanc", "Jeudi 30 avril — GO atelier 2", "Vendredi 1er mai — Physique correction", "Samedi 2 mai — Maths correction finale + GO atelier 3"],
    followUp: ["Bilan intermédiaire", "Corrigés détaillés + retour oral", "Bilan final complet"],
  },
];

const categories = [
  { key: "all", label: "Toutes", color: "from-white/40 to-white/20", icon: Sparkles },
  { key: "mono", label: "1 matière", color: "from-blue-500 to-cyan-500", icon: BookOpen },
  { key: "duo", label: "2 matières", color: "from-violet-500 to-purple-500", icon: Users },
  { key: "parcours", label: "Parcours complet", color: "from-emerald-500 to-teal-500", icon: GraduationCap },
];

const levelLabels = { premiere: "Première", terminale: "Terminale" };

// ============================================
// UI HELPERS
// ============================================

function PriceBlock({ price, oldPrice }: { price: number; oldPrice?: number | null }) {
  const savings = oldPrice ? oldPrice - price : 0;
  return (
    <div className="text-right">
      <motion.div className="text-2xl font-bold tracking-tight text-white md:text-3xl" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
        {price.toLocaleString("fr-FR")} TND
      </motion.div>
      {oldPrice && (
        <motion.div className="mt-1 flex items-center justify-end gap-2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <span className="text-sm text-white/40 line-through">{oldPrice.toLocaleString("fr-FR")} TND</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">-{savings.toLocaleString("fr-FR")} TND</span>
        </motion.div>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div className="space-y-3" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl">{title}</h2>
      <p className="max-w-3xl text-sm leading-relaxed text-white/55 md:text-base">{subtitle}</p>
    </motion.div>
  );
}

function NexusBadge({ children, className, featured }: { children: React.ReactNode; className?: string; featured?: boolean }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wider", featured ? "border-amber-500/30 bg-amber-500/15 text-amber-300" : "border-white/10 bg-white/[0.06] text-white/70", className)}>
      {children}
    </span>
  );
}

function NexusButton({ children, variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "outline" | "ghost" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-gradient-to-r from-nexus-green to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:brightness-110",
        variant === "outline" && "border border-white/20 bg-white/[0.04] text-white hover:bg-white/[0.08]",
        variant === "ghost" && "text-white/70 hover:bg-white/[0.06] hover:text-white",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function NexusStagesPage() {
  const [level, setLevel] = useState<"premiere" | "terminale">("premiere");
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<typeof offers[0] | null>(null);
  const [isReservationOpen, setIsReservationOpen] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const filteredOffers = useMemo(() => {
    const list = offers
      .filter((offer) => offer.level === level)
      .filter((offer) => (category === "all" ? true : offer.category === category))
      .filter((offer) => {
        const haystack = [offer.title, offer.badge, offer.shortPitch, offer.subjectKey].join(" ").toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
      .sort((a, b) => {
        const aScore = (a.featured ? 10 : 0) + (a.category === "duo" ? 2 : 0);
        const bScore = (b.featured ? 10 : 0) + (b.category === "duo" ? 2 : 0);
        return bScore - aScore;
      });
    return list;
  }, [level, category, query]);

  const slots = whiteExamSlots[level];

  useEffect(() => {
    const defaultOpen = filteredOffers[0]?.id ?? null;
    setOpenId(defaultOpen);
  }, [level, category, query]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  const handleReservation = (offer: typeof offers[0]) => {
    setSelectedOffer(offer);
    setIsReservationOpen(true);
  };

  const confirmReservation = () => {
    setIsReservationOpen(false);
  };

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const tableData = useMemo(() => {
    const data: Array<{ date: string; time: string; subject: string; type: string; level: string; offer: string; offerId: string }> = [];
    offers.forEach((offer) => {
      offer.planning.forEach((plan) => {
        const dateMatch = plan.match(/^([^·]+)·/);
        const date = dateMatch ? dateMatch[1].trim() : "";
        const timeMatch = plan.match(/(\d{2}h\d{2}[^·]*)/);
        const time = timeMatch ? timeMatch[1].trim() : "";
        data.push({ date, time, subject: offer.subjectKey, type: offer.category, level: offer.level, offer: offer.title, offerId: offer.id });
      });
    });
    return data.sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  return (
    <div className="min-h-screen bg-nexus-bg font-body text-white selection:bg-nexus-green/25 selection:text-white">
      <CorporateNavbar />

      <main id="main-content" className="pt-24 md:pt-28">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 pb-20 pt-12 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(16,185,129,0.10),transparent_42%),radial-gradient(ellipse_at_80%_70%,rgba(245,158,11,0.06),transparent_32%)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:48px_48px]" />

          <div className="relative mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <motion.div className="space-y-8" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <span className="mb-4 inline-block rounded-full border border-nexus-green/25 bg-white/[0.04] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/65">
                    <Sparkles className="mr-2 inline-block h-3.5 w-3.5 text-nexus-green" />
                    Stages Printemps 2026 · 18 avril — 2 mai · Tunis
                  </span>
                </motion.div>

                <div className="space-y-5">
                  <motion.h1 className="max-w-4xl font-display text-3xl font-extrabold leading-[1.05] text-white sm:text-4xl md:text-5xl lg:text-6xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    Préparez les échéances de mai et juin avec méthode, exigence et un cadre qui fait vraiment travailler.
                  </motion.h1>
                  <motion.p className="max-w-2xl text-base leading-7 text-white/55 sm:text-lg sm:leading-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    Des groupes de 6 élèves maximum. Des intervenants du système français. Des entraînements corrigés, des épreuves blanches et un plan de révision final.
                  </motion.p>
                </div>

                <motion.div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <a href="#offres" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-nexus-green to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50 sm:w-auto">
                    Voir les formules disponibles
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <NexusButton variant="outline" className="w-full sm:w-auto" onClick={() => setIsTableOpen(true)}>
                    <Calendar className="h-4 w-4" />
                    Voir le calendrier
                  </NexusButton>
                </motion.div>

                <motion.div className="flex items-center gap-6 pt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-nexus-bg bg-gradient-to-br from-nexus-green to-emerald-600 text-xs font-bold text-white">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-white/55">
                    <span className="font-semibold text-white">+500 élèves</span> accompagnés chaque année
                  </div>
                </motion.div>
              </motion.div>

              <motion.div className="grid gap-4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
                {scheduleWindows.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + index * 0.1 }}>
                      <div className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05]">
                        <div className="p-5">
                          <div className="flex items-start gap-4">
                            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg", item.color)}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white/50">{item.title}</div>
                              <div className="mt-1 text-xl font-bold text-white">{item.value}</div>
                              <p className="mt-1 text-sm leading-relaxed text-white/50">{item.note}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-y border-white/8 bg-white/[0.02]">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: "14", label: "Stages proposés", suffix: "" },
                { value: "4", label: "Matières", suffix: "" },
                { value: "6", label: "Élèves max", suffix: "" },
                { value: "95", label: "Taux de satisfaction", suffix: "%" },
              ].map((stat, i) => (
                <motion.div key={stat.label} className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <div className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">{stat.value}{stat.suffix}</div>
                  <div className="mt-1 text-sm text-white/50">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section id="offers" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]">
            <div className="space-y-10">
              <SectionTitle title="Choisissez la formule la plus adaptée" subtitle="Les offres sont organisées par niveau, puis filtrables par type de parcours. Chaque formule détaille ses horaires, ses épreuves blanches, ses bilans et le suivi transmis à l'élève et à sa famille. Un stage Nexus coûte moins qu'un équivalent en cours individuels." />

              {/* Filters */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="inline-flex rounded-2xl bg-white/[0.04] p-1.5">
                    {Object.entries(levelLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setLevel(key as "premiere" | "terminale")}
                        className={cn(
                          "relative rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300",
                          level === key ? "bg-white text-slate-900 shadow-md" : "text-white/60 hover:text-white"
                        )}
                      >
                        {level === key && <motion.div layoutId="levelIndicator" className="absolute inset-0 rounded-xl bg-white shadow-md" transition={{ type: "spring", stiffness: 300 }} />}
                        <span className="relative z-10">{label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full md:max-w-sm">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher une matière ou formule..."
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/40 focus:border-nexus-green/40 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {categories.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setCategory(item.key)}
                        className={cn(
                          "group relative inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300",
                          category === item.key ? "border-transparent text-white" : "border-white/10 bg-white/[0.04] text-white/60 hover:border-white/15 hover:bg-white/[0.06] hover:text-white"
                        )}
                      >
                        {category === item.key && <motion.div layoutId="categoryIndicator" className={cn("absolute inset-0 rounded-full bg-gradient-to-r", item.color)} transition={{ type: "spring", stiffness: 300 }} />}
                        <Icon className={cn("relative z-10 h-4 w-4", category === item.key ? "text-white" : "text-white/50 group-hover:text-white")} />
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {[
                    { title: "1 matière", desc: "Pour cibler une priorité précise", icon: BookOpen, color: "from-blue-500 to-cyan-500" },
                    { title: "2 matières", desc: "Préparation cohérente et avantageuse", icon: Users, color: "from-violet-500 to-purple-500" },
                    { title: "Parcours complet", desc: "Organisation lisible et complète", icon: GraduationCap, color: "from-emerald-500 to-teal-500" },
                  ].map((item, i) => (
                    <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                      <div className="group cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05]">
                        <div className="p-5">
                          <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110", item.color)}>
                            <item.icon className="h-5 w-5 text-white" />
                          </div>
                          <div className="font-semibold text-white">{item.title}</div>
                          <p className="mt-1 text-sm leading-relaxed text-white/55">{item.desc}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Offers List */}
              <div className="space-y-5">
                <AnimatePresence mode="popLayout">
                  {filteredOffers.map((offer, index) => {
                    const Icon = offer.icon;
                    const isOpen = openId === offer.id;
                    const isFavorite = favorites.includes(offer.id);
                    return (
                      <motion.div
                        key={offer.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <div className={cn("group overflow-hidden rounded-3xl border bg-white/[0.03] transition-all duration-500 hover:border-white/15 hover:bg-white/[0.05]", offer.featured ? "border-amber-500/25" : "border-white/10")}>
                          <div className={cn("bg-gradient-to-r p-px", offer.bgGradient)}>
                            <div className="rounded-3xl bg-nexus-bg p-6">
                              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                <div className="flex-1 space-y-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <NexusBadge featured={offer.featured}>{offer.badge}</NexusBadge>
                                    <NexusBadge>{offer.category === "mono" ? "1 matière" : offer.category === "duo" ? "2 matières" : "Parcours complet"}</NexusBadge>
                                    {offer.featured && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                                        <Star className="h-3 w-3 fill-current" />
                                        Populaire
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-start gap-4">
                                    <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-110", offer.color)}>
                                      <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                      <h3 className="text-lg font-bold text-white sm:text-xl md:text-2xl">{offer.title}</h3>
                                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">{offer.shortPitch}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col items-start gap-3 md:min-w-[200px] md:items-end">
                                  <button onClick={() => toggleFavorite(offer.id)} className="rounded-full p-2 transition-colors hover:bg-white/[0.06]">
                                    <Heart className={cn("h-5 w-5 transition-colors", isFavorite ? "fill-rose-500 text-rose-500" : "text-white/40")} />
                                  </button>

                                  <div className="flex items-center gap-2 text-sm text-white/55">
                                    <Clock3 className="h-4 w-4" />
                                    <span className="font-medium">{offer.hours} heures</span>
                                  </div>
                                  <PriceBlock price={offer.price} oldPrice={offer.oldPrice} />
                                </div>
                              </div>

                              <div className="mt-5 flex flex-col gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-white">{offer.threshold}</div>
                                  <p className="text-sm text-white/40">Tarif standard — ajustement possible si le groupe se complète</p>
                                  {offer.bonus && (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm">
                                      <Sparkles className="h-4 w-4 text-emerald-400" />
                                      <span className="font-medium text-emerald-300">{offer.bonus.title}</span>
                                      <span className="text-emerald-400/80">· {offer.bonus.value}</span>
                                    </motion.div>
                                  )}
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                  <NexusButton variant="outline" className="w-full sm:w-auto" onClick={() => setOpenId(isOpen ? null : offer.id)}>
                                    {isOpen ? "Réduire" : "Voir le détail"}
                                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", isOpen ? "rotate-180" : "")} />
                                  </NexusButton>
                                  <NexusButton className="w-full sm:w-auto" onClick={() => handleReservation(offer)}>
                                    Réserver ma place
                                    <ArrowRight className="h-4 w-4" />
                                  </NexusButton>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isOpen && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                                    <div className="mt-6 grid gap-6 border-t border-white/10 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
                                      <div className="space-y-5">
                                        <div>
                                          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/50">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Ce qui est inclus
                                          </h4>
                                          <div className="grid gap-2">
                                            {offer.points.map((point, i) => (
                                              <motion.div key={point} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 rounded-xl bg-white/[0.03] p-3">
                                                <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br", offer.color)}>
                                                  <Check className="h-3 w-3 text-white" />
                                                </div>
                                                <span className="text-sm text-white/70">{point}</span>
                                              </motion.div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                              <CreditCard className="h-4 w-4 text-white/50" />
                                              Réservation
                                            </div>
                                            <p className="mt-2 text-sm leading-relaxed text-white/55">50% à l&apos;inscription, solde avant le démarrage</p>
                                          </div>
                                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                              <BadgeCheck className="h-4 w-4 text-white/50" />
                                              Suivi
                                            </div>
                                            <div className="mt-2 space-y-1">
                                              {offer.followUp?.slice(0, 2).map((item) => (
                                                <div key={item} className="flex items-start gap-2 text-xs text-white/55">
                                                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                                                  <span>{item}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                                        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-white/50">
                                          <CalendarDays className="h-4 w-4" />
                                          Planning
                                        </h4>
                                        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-2">
                                          {offer.planning.map((line, i) => (
                                            <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2.5 text-sm">
                                              <div className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r", offer.color)} />
                                              <span className="text-white/60">{line}</span>
                                            </motion.div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <div className="sticky top-24 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                  <div className="bg-gradient-to-r from-nexus-green to-emerald-600 p-6">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                      <Calendar className="h-5 w-5" />
                      Créneaux blancs clés
                    </h3>
                    <p className="mt-1 text-sm text-white/80">{levelLabels[level]}</p>
                  </div>
                  <div className="space-y-3 p-5">
                    {slots.map((slot, i) => (
                      <motion.div
                        key={slot.title}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn("group cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:border-white/20", slot.color)}
                        onClick={() => setSelectedSlot(selectedSlot === slot.title ? null : slot.title)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white">{slot.title}</div>
                            <div className="mt-1 text-sm text-white/70">{slot.date}</div>
                            <div className="mt-1 text-sm font-medium text-white/90">{slot.time}</div>
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/70">{slot.type}</span>
                        </div>
                        <AnimatePresence>
                          {selectedSlot === slot.title && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 border-t border-white/10 pt-3">
                              <NexusButton variant="outline" className="w-full py-2 text-xs" onClick={(e) => { e.stopPropagation(); }}>
                                S&apos;inscrire à cette épreuve
                              </NexusButton>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
                <div className="overflow-hidden rounded-3xl border border-amber-500/20 bg-amber-500/[0.05]">
                  <div className="p-5 sm:p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                      <Star className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Pourquoi choisir un pack ?</h3>
                    <ul className="mt-4 space-y-3">
                      {["Un seul cadre organisé", "Progression cohérente", "Tarif avantageux", "Suivi global"].map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-white/70">
                          <Check className="h-4 w-4 text-amber-400" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
                <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                  <div className="p-5 sm:p-6">
                    <h3 className="text-lg font-bold text-white">Nos engagements</h3>
                    <div className="mt-4 space-y-4">
                      {[
                        { icon: Users, label: "Groupes limités à 6 élèves", color: "from-blue-500 to-cyan-500" },
                        { icon: BadgeCheck, label: "Cadre structuré et suivi clair", color: "from-emerald-500 to-teal-500" },
                        { icon: GraduationCap, label: "Formules progressives", color: "from-violet-500 to-purple-500" },
                        { icon: Sparkles, label: "Bonus pédagogiques inclus", color: "from-amber-500 to-orange-500" },
                      ].map(({ icon: Icon, label, color }) => (
                        <div key={label} className="flex items-center gap-3">
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-md", color)}>
                            <Icon className="h-4 w-4 text-white" />
                          </div>
                          <span className="text-sm font-medium text-white/80">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Summary Table accessible via modal only */}
      </main>

      {/* Final CTA */}
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.10),transparent_52%)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-nexus-green">Stages Printemps 2026 · 18 avril — 2 mai</p>
          <h2 className="mt-4 text-xl font-bold text-white sm:text-2xl md:text-3xl">
            Le 2 mai, vous repartez avec une méthode posée, des points faibles identifiés et un plan de révision prêt à exécuter.
          </h2>
          <p className="mt-5 text-base leading-8 text-white/55">
            Les semaines qui suivent servent à capitaliser sur ce travail — pas à recommencer de zéro. Les groupes sont à 6 élèves maximum. Les inscriptions se ferment quand les places sont pleines.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#offres" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-nexus-green to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50 sm:w-auto sm:min-w-[260px]">
              Réserver ma place
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <a href="mailto:contact@nexusreussite.academy" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.04] px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50 sm:w-auto sm:min-w-[240px]">
              <Mail className="h-4 w-4" aria-hidden="true" />
              Nous contacter
            </a>
          </div>
        </div>
      </section>

      <CorporateFooter />

      {/* Table Modal */}
      <AnimatePresence>
        {isTableOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="max-h-[80vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#111826]">
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <h3 className="text-lg font-bold text-white">Tableau récapitulatif complet</h3>
                <button onClick={() => setIsTableOpen(false)} className="rounded-full p-2 text-white/50 hover:bg-white/[0.06] hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-auto p-5">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="sticky top-0">
                    <tr className="border-b border-white/10 bg-white/[0.06]">
                      <th className="px-4 py-3 text-left font-semibold text-white">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-white">Horaire</th>
                      <th className="px-4 py-3 text-left font-semibold text-white">Matière</th>
                      <th className="px-4 py-3 text-left font-semibold text-white">Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-white">Niveau</th>
                      <th className="px-4 py-3 text-left font-semibold text-white">Formule</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row, i) => (
                      <tr key={i} className="border-b border-white/5 transition-colors hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-medium text-white/90">{row.date}</td>
                        <td className="px-4 py-3 text-white/60">{row.time}</td>
                        <td className="px-4 py-3 text-white/60">{row.subject}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-white/70">{row.type}</span>
                        </td>
                        <td className="px-4 py-3 text-white/60">{row.level === "premiere" ? "Première" : "Terminale"}</td>
                        <td className="px-4 py-3 text-white/60">{row.offer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Modal */}
      <AnimatePresence>
        {isContactOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#111826] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Contact</h3>
                <button onClick={() => setIsContactOpen(false)} className="rounded-full p-2 text-white/50 hover:bg-white/[0.06] hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-white/70">
                  <Phone className="h-5 w-5 text-nexus-green" />
                  <span>+216 XX XXX XXX</span>
                </div>
                <div className="flex items-center gap-3 text-white/70">
                  <Mail className="h-5 w-5 text-nexus-green" />
                  <span>contact@nexusreussite.academy</span>
                </div>
                <div className="flex items-center gap-3 text-white/70">
                  <MapPin className="h-5 w-5 text-nexus-green" />
                  <span>Tunis, Tunisie</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reservation Modal */}
      <AnimatePresence>
        {isReservationOpen && selectedOffer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#111826] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Réservation</h3>
                <button onClick={() => setIsReservationOpen(false)} className="rounded-full p-2 text-white/50 hover:bg-white/[0.06] hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-6 text-white/60">
                Vous souhaitez réserver la formule <span className="font-semibold text-white">{selectedOffer.title}</span> à <span className="font-semibold text-white">{selectedOffer.price.toLocaleString("fr-FR")} TND</span>.
              </p>
              <div className="flex gap-3">
                <NexusButton variant="outline" className="flex-1" onClick={() => setIsReservationOpen(false)}>
                  Annuler
                </NexusButton>
                <NexusButton className="flex-1" onClick={confirmReservation}>
                  Confirmer
                </NexusButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll to top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} onClick={scrollToTop} className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/[0.12]">
            <ChevronUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
