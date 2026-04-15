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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table as UITable, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// ============================================
// DATA
// ============================================

const scheduleWindows = [
  {
    title: "Période des stages",
    value: "18 avril → 2 mai",
    icon: CalendarDays,
    note: "Hors dimanches — groupes lancés selon constitution effective.",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    title: "Réservation",
    value: "50 % à l'inscription",
    icon: CreditCard,
    note: "Le solde est complété avant le démarrage.",
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    title: "Effectif",
    value: "2 à 6 élèves",
    icon: Users,
    note: "Selon la formule et le seuil d'ouverture retenu.",
    color: "from-violet-500 to-purple-500",
    bgColor: "bg-violet-50",
    iconColor: "text-violet-600",
  },
];

const whiteExamSlots = {
  premiere: [
    { title: "Français écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", color: "bg-blue-50 text-blue-700 border-blue-200", subject: "Français", type: "Écrit" },
    { title: "Maths écrit blanc", date: "Mercredi 29 avril", time: "09h00 – 12h00", color: "bg-cyan-50 text-cyan-700 border-cyan-200", subject: "Maths", type: "Écrit" },
    { title: "Français oral blanc", date: "Jeudi 30 avril", time: "13h30 – 16h30", color: "bg-indigo-50 text-indigo-700 border-indigo-200", subject: "Français", type: "Oral" },
  ],
  terminale: [
    { title: "NSI écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", color: "bg-violet-50 text-violet-700 border-violet-200", subject: "NSI", type: "Écrit" },
    { title: "Physique-Chimie écrit blanc", date: "Mardi 28 avril", time: "09h00 – 12h00", color: "bg-pink-50 text-pink-700 border-pink-200", subject: "Physique-Chimie", type: "Écrit" },
    { title: "Maths écrit blanc", date: "Mercredi 29 avril", time: "09h00 – 12h00", color: "bg-rose-50 text-rose-700 border-rose-200", subject: "Maths", type: "Écrit" },
    { title: "NSI pratique blanche", date: "Jeudi 30 avril", time: "09h00 – 12h00", color: "bg-emerald-50 text-emerald-700 border-emerald-200", subject: "NSI", type: "Pratique" },
    { title: "Ateliers Grand Oral", date: "28 avril / 30 avril / 2 mai", time: "17h00 – 19h00", color: "bg-amber-50 text-amber-700 border-amber-200", subject: "Grand Oral", type: "Atelier" },
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
    bgGradient: "from-cyan-500/10 via-blue-500/5 to-transparent",
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
    bgGradient: "from-blue-500/10 via-indigo-500/5 to-transparent",
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
    bgGradient: "from-violet-500/10 via-fuchsia-500/5 to-transparent",
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
    bgGradient: "from-amber-500/15 via-orange-500/10 to-transparent",
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
    bgGradient: "from-emerald-500/15 via-cyan-500/10 to-transparent",
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
    bgGradient: "from-fuchsia-500/15 via-indigo-500/10 to-transparent",
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
    bgGradient: "from-rose-500/10 via-orange-500/5 to-transparent",
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
    bgGradient: "from-violet-500/10 via-purple-500/5 to-transparent",
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
    bgGradient: "from-emerald-500/10 via-teal-500/5 to-transparent",
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
    bgGradient: "from-amber-500/10 via-yellow-500/5 to-transparent",
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
    bgGradient: "from-emerald-500/15 via-cyan-500/10 to-transparent",
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
    bgGradient: "from-orange-500/15 via-rose-500/10 to-transparent",
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
    bgGradient: "from-indigo-500/15 via-fuchsia-500/10 to-transparent",
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
    bgGradient: "from-sky-500/15 via-indigo-500/10 to-transparent",
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
  { key: "all", label: "Toutes", color: "bg-slate-900", icon: Sparkles },
  { key: "mono", label: "1 matière", color: "bg-blue-500", icon: BookOpen },
  { key: "duo", label: "2 matières", color: "bg-violet-500", icon: Users },
  { key: "parcours", label: "Parcours complet", color: "bg-emerald-500", icon: GraduationCap },
];

const levelLabels = { premiere: "Première", terminale: "Terminale" };

// ============================================
// COMPONENTS
// ============================================

function PriceBlock({ price, oldPrice }: { price: number; oldPrice?: number | null }) {
  const savings = oldPrice ? oldPrice - price : 0;
  return (
    <div className="text-right">
      <motion.div className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
        {price.toLocaleString("fr-FR")} TND
      </motion.div>
      {oldPrice && (
        <motion.div className="mt-1 flex items-center justify-end gap-2" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <span className="text-sm text-slate-400 line-through">{oldPrice.toLocaleString("fr-FR")} TND</span>
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Économisez {savings.toLocaleString("fr-FR")} TND</Badge>
        </motion.div>
      )}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <motion.div className="space-y-3" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
      <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent md:text-4xl">{title}</h2>
      <p className="max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">{subtitle}</p>
    </motion.div>
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
    setFavorites((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
    toast.success(favorites.includes(id) ? "Retiré des favoris" : "Ajouté aux favoris");
  };

  const handleReservation = (offer: typeof offers[0]) => {
    setSelectedOffer(offer);
    setIsReservationOpen(true);
  };

  const confirmReservation = () => {
    toast.success("Demande de réservation envoyée !", {
      description: `Nous vous contacterons pour finaliser votre inscription au stage ${selectedOffer?.title}.`,
      duration: 5000,
    });
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
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 text-slate-900">
        
        {/* Navigation */}
        <motion.nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl" initial={{ y: -100 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 100 }}>
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-violet-600">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">Nexus Réussite</span>
            </div>
            <div className="hidden items-center gap-4 md:flex">
              <Button variant="ghost" size="sm" onClick={() => setIsTableOpen(true)} className="gap-2">
                <TableIcon className="h-4 w-4" />
                Tableau récapitulatif
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsContactOpen(true)} className="gap-2">
                <Phone className="h-4 w-4" />
                Contact
              </Button>
              <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-700">
                <Sparkles className="mr-1 h-3 w-3" />
                Stages 2026
              </Badge>
            </div>
            <Sheet>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
                <div className="mt-6 flex flex-col gap-4">
                  <Button variant="ghost" onClick={() => setIsTableOpen(true)} className="justify-start"><TableIcon className="mr-2 h-4 w-4" />Tableau récapitulatif</Button>
                  <Button variant="ghost" onClick={() => setIsContactOpen(true)} className="justify-start"><Phone className="mr-2 h-4 w-4" />Contact</Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </motion.nav>

        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%),radial-gradient(ellipse_at_top_left,rgba(124,58,237,0.15),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(16,185,129,0.1),transparent_40%)]" />
            <motion.div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity }} />
            <motion.div className="absolute -left-20 top-40 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 10, repeat: Infinity }} />
          </div>
          
          <div className="relative mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <motion.div className="space-y-8" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }}>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <Badge className="mb-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-1.5 text-white hover:from-blue-700 hover:to-violet-700">
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    Édition 2026 — Inscriptions ouvertes
                  </Badge>
                </motion.div>
                
                <div className="space-y-5">
                  <motion.h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-slate-950 md:text-5xl lg:text-6xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    Préparez votre <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">réussite</span> aux examens
                  </motion.h1>
                  <motion.p className="max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    Stages de printemps intensifs pour les classes de Première et Terminale. Horaires précis, épreuves blanches intégrées, bilans intermédiaires transmis aux familles.
                  </motion.p>
                </div>
                
                <motion.div className="flex flex-wrap gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <Button size="lg" className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-8 text-white hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25" onClick={() => document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" })}>
                    Explorer les offres
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-full px-8" onClick={() => setIsTableOpen(true)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Voir le calendrier
                  </Button>
                </motion.div>

                <motion.div className="flex items-center gap-6 pt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                  <div className="flex -space-x-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">+500 élèves</span> accompagnés chaque année
                  </div>
                </motion.div>
              </motion.div>

              <motion.div className="grid gap-4" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
                {scheduleWindows.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + index * 0.1 }}>
                      <Card className="group overflow-hidden rounded-3xl border-slate-200/60 bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.color} shadow-lg`}>
                              <Icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-slate-500">{item.title}</div>
                              <div className="mt-1 text-xl font-bold text-slate-900">{item.value}</div>
                              <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.note}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats Bar */}
        <section className="border-y border-slate-200/60 bg-white/50 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: "14", label: "Stages proposés", suffix: "" },
                { value: "4", label: "Matières", suffix: "" },
                { value: "6", label: "Élèves max", suffix: "" },
                { value: "95", label: "Taux de satisfaction", suffix: "%" },
              ].map((stat, i) => (
                <motion.div key={stat.label} className="text-center" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent md:text-4xl">{stat.value}{stat.suffix}</div>
                  <div className="mt-1 text-sm text-slate-600">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section id="offers" className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            <div className="space-y-10">
              <SectionTitle title="Choisissez votre formule" subtitle="Les offres sont organisées par niveau, puis filtrables par type de parcours. Chaque formule détaille ses horaires, ses épreuves blanches, ses bilans et le suivi transmis à l’élève et à sa famille." />

              {/* Filters */}
              <Card className="overflow-hidden rounded-3xl border-slate-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-slate-500/5">
                <CardContent className="space-y-6 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="inline-flex rounded-2xl bg-slate-100 p-1.5">
                      {Object.entries(levelLabels).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setLevel(key as "premiere" | "terminale")}
                          className={`relative rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${level === key ? "bg-white text-slate-900 shadow-md" : "text-slate-600 hover:text-slate-900"}`}
                        >
                          {level === key && (
                            <motion.div layoutId="levelIndicator" className="absolute inset-0 rounded-xl bg-white shadow-md" transition={{ type: "spring", stiffness: 300 }} />
                          )}
                          <span className="relative z-10">{label}</span>
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full md:max-w-sm">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher une matière ou formule..." className="rounded-2xl border-slate-200 pl-11 py-5 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {categories.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.key}
                          onClick={() => setCategory(item.key)}
                          className={`group relative inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300 ${category === item.key ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}
                        >
                          {category === item.key && <motion.div layoutId="categoryIndicator" className={`absolute inset-0 rounded-full ${item.color}`} transition={{ type: "spring", stiffness: 300 }} />}
                          <Icon className={`relative z-10 h-4 w-4 ${category === item.key ? "text-white" : "text-slate-500 group-hover:text-slate-700"}`} />
                          <span className="relative z-10">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { title: "1 matière", desc: "Pour cibler une priorité précise", icon: BookOpen, color: "from-blue-500 to-cyan-500" },
                      { title: "2 matières", desc: "Préparation cohérente et avantageuse", icon: Users, color: "from-violet-500 to-purple-500" },
                      { title: "Parcours complet", desc: "Organisation lisible et complète", icon: GraduationCap, color: "from-emerald-500 to-teal-500" },
                    ].map((item, i) => (
                      <motion.div key={item.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                        <Card className="group cursor-pointer overflow-hidden rounded-2xl border-slate-200/60 bg-gradient-to-br from-slate-50 to-white transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                          <CardContent className="p-5">
                            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                              <item.icon className="h-5 w-5 text-white" />
                            </div>
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <p className="mt-1 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>

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
                        <Card className={`group overflow-hidden rounded-3xl border-slate-200/60 bg-white shadow-sm transition-all duration-500 hover:shadow-xl ${offer.featured ? "ring-2 ring-amber-400/50" : ""}`}>
                          <div className={`bg-gradient-to-r ${offer.bgGradient} p-1`}>
                            <CardContent className="p-6">
                              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                                <div className="flex-1 space-y-4">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={`rounded-full bg-gradient-to-r ${offer.color} text-white border-0`}>
                                      {offer.badge}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full bg-white/70">
                                      {offer.category === "mono" ? "1 matière" : offer.category === "duo" ? "2 matières" : "Parcours complet"}
                                    </Badge>
                                    {offer.featured && (
                                      <Badge className="rounded-full bg-amber-100 text-amber-700 border-amber-200">
                                        <Star className="mr-1 h-3 w-3 fill-current" />
                                        Populaire
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-start gap-4">
                                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${offer.color} shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
                                      <Icon className="h-6 w-6 text-white" />
                                    </div>
                                    <div>
                                      <h3 className="text-xl font-bold text-slate-950 md:text-2xl">{offer.title}</h3>
                                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{offer.shortPitch}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-3 md:min-w-[200px]">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button onClick={() => toggleFavorite(offer.id)} className="rounded-full p-2 transition-colors hover:bg-slate-100">
                                        <Heart className={`h-5 w-5 transition-colors ${isFavorite ? "fill-rose-500 text-rose-500" : "text-slate-400"}`} />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>{isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}</TooltipContent>
                                  </Tooltip>
                                  
                                  <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <Clock3 className="h-4 w-4" />
                                    <span className="font-medium">{offer.hours} heures</span>
                                  </div>
                                  <PriceBlock price={offer.price} oldPrice={offer.oldPrice} />
                                </div>
                              </div>

                              <div className="mt-5 flex flex-col gap-4 border-t border-slate-200/60 pt-5 md:flex-row md:items-center md:justify-between">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-slate-900">{offer.threshold}</div>
                                  <p className="text-sm text-slate-500">Tarif standard — ajustement possible si le groupe se complète</p>
                                  {offer.bonus && (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm">
                                      <Sparkles className="h-4 w-4 text-emerald-600" />
                                      <span className="font-medium text-emerald-800">{offer.bonus.title}</span>
                                      <span className="text-emerald-600">• {offer.bonus.value}</span>
                                    </motion.div>
                                  )}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                  <Button variant="outline" className="rounded-xl" onClick={() => setOpenId(isOpen ? null : offer.id)}>
                                    {isOpen ? "Réduire" : "Voir le détail"}
                                    <ChevronDown className={`ml-2 h-4 w-4 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                                  </Button>
                                  <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25" onClick={() => handleReservation(offer)}>
                                    Réserver
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isOpen && (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                                    <div className="mt-6 grid gap-6 border-t border-slate-200/60 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
                                      <div className="space-y-5">
                                        <div>
                                          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                                            <CheckCircle2 className="h-4 w-4" />
                                            Ce qui est inclus
                                          </h4>
                                          <div className="grid gap-2">
                                            {offer.points.map((point, i) => (
                                              <motion.div key={point} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                                                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${offer.color}`}>
                                                  <Check className="h-3 w-3 text-white" />
                                                </div>
                                                <span className="text-sm text-slate-700">{point}</span>
                                              </motion.div>
                                            ))}
                                          </div>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                          <Card className="rounded-2xl border-slate-200/60 bg-slate-50/50">
                                            <CardContent className="p-4">
                                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                <CreditCard className="h-4 w-4 text-slate-500" />
                                                Réservation
                                              </div>
                                              <p className="mt-2 text-sm leading-relaxed text-slate-600">50% à l'inscription, solde avant le démarrage</p>
                                            </CardContent>
                                          </Card>
                                          <Card className="rounded-2xl border-slate-200/60 bg-slate-50/50">
                                            <CardContent className="p-4">
                                              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                <BadgeCheck className="h-4 w-4 text-slate-500" />
                                                Suivi
                                              </div>
                                              <div className="mt-2 space-y-1">
                                                {offer.followUp?.slice(0, 2).map((item) => (
                                                  <div key={item} className="flex items-start gap-2 text-xs text-slate-600">
                                                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                                                    <span>{item}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </CardContent>
                                          </Card>
                                        </div>
                                      </div>

                                      <Card className="rounded-2xl border-slate-200/60 bg-slate-50/50">
                                        <CardContent className="p-4">
                                          <h4 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                                            <CalendarDays className="h-4 w-4" />
                                            Planning
                                          </h4>
                                          <ScrollArea className="h-[280px] pr-4">
                                            <div className="space-y-2">
                                              {offer.planning.map((line, i) => (
                                                <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-sm shadow-sm">
                                                  <div className={`mt-0.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-r ${offer.color}`} />
                                                  <span className="text-slate-700">{line}</span>
                                                </motion.div>
                                              ))}
                                            </div>
                                          </ScrollArea>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </CardContent>
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
                <Card className="sticky top-24 overflow-hidden rounded-3xl border-slate-200/60 bg-white shadow-lg shadow-slate-500/5">
                  <div className="bg-gradient-to-r from-blue-600 to-violet-600 p-6">
                    <CardTitle className="flex items-center gap-2 text-lg text-white">
                      <Calendar className="h-5 w-5" />
                      Créneaux blancs clés
                    </CardTitle>
                    <p className="mt-1 text-sm text-blue-100">{levelLabels[level]}</p>
                  </div>
                  <CardContent className="space-y-3 p-5">
                    {slots.map((slot, i) => (
                      <motion.div key={slot.title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className={`group cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:shadow-md ${slot.color}`} onClick={() => setSelectedSlot(selectedSlot === slot.title ? null : slot.title)}>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-semibold">{slot.title}</div>
                            <div className="mt-1 text-sm opacity-80">{slot.date}</div>
                            <div className="mt-1 text-sm font-medium">{slot.time}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">{slot.type}</Badge>
                        </div>
                        <AnimatePresence>
                          {selectedSlot === slot.title && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 border-t border-current border-opacity-20 pt-3">
                              <Button size="sm" variant="outline" className="w-full text-xs" onClick={(e) => { e.stopPropagation(); toast.info("Inscription à l'épreuve blanche enregistrée"); }}>
                                S'inscrire à cette épreuve
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
                <Card className="overflow-hidden rounded-3xl border-slate-200/60 bg-gradient-to-br from-amber-50 to-orange-50">
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                      <Star className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Pourquoi choisir un pack ?</h3>
                    <ul className="mt-4 space-y-3">
                      {["Un seul cadre organisé", "Progression cohérente", "Tarif avantageux", "Suivi global"].map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                          <Check className="h-4 w-4 text-amber-600" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
                <Card className="overflow-hidden rounded-3xl border-slate-200/60 bg-white">
                  <CardHeader>
                    <CardTitle className="text-lg">Nos engagements</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { icon: Users, label: "Groupes limités à 6 élèves", color: "from-blue-500 to-cyan-500" },
                      { icon: BadgeCheck, label: "Cadre structuré et suivi clair", color: "from-emerald-500 to-teal-500" },
                      { icon: GraduationCap, label: "Formules progressives", color: "from-violet-500 to-purple-500" },
                      { icon: Sparkles, label: "Bonus pédagogiques inclus", color: "from-amber-500 to-orange-500" },
                    ].map(({ icon: Icon, label, color }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-md`}>
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{label}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Summary Table Section */}
        <section className="border-t border-slate-200/60 bg-white/50 py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <SectionTitle title="Tableau récapitulatif complet" subtitle="Consultez l'ensemble des créneaux, matières et niveaux en un coup d'œil. Filtrez par date ou par niveau pour planifier votre préparation." />
            
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8">
              <Card className="overflow-hidden rounded-3xl border-slate-200/60 shadow-lg">
                <div className="overflow-x-auto">
                  <UITable>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Horaire</TableHead>
                        <TableHead className="font-semibold">Matière</TableHead>
                        <TableHead className="font-semibold">Type</TableHead>
                        <TableHead className="font-semibold">Niveau</TableHead>
                        <TableHead className="font-semibold">Formule</TableHead>
                        <TableHead className="font-semibold text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.slice(0, 15).map((row, i) => (
                        <motion.tr key={i} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.02 }} className="group hover:bg-blue-50/50 transition-colors">
                          <TableCell className="font-medium">{row.date}</TableCell>
                          <TableCell>{row.time}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{row.subject}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={row.type === "mono" ? "bg-blue-100 text-blue-700" : row.type === "duo" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"}>
                              {row.type === "mono" ? "1 matière" : row.type === "duo" ? "2 matières" : "Parcours"}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">{levelLabels[row.level as keyof typeof levelLabels]}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{row.offer}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleReservation(offers.find(o => o.id === row.offerId)!)}>
                              Réserver
                            </Button>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </UITable>
                </div>
                <div className="border-t border-slate-200 p-4 text-center">
                  <Button variant="outline" onClick={() => setIsTableOpen(true)}>
                    <TableIcon className="mr-2 h-4 w-4" />
                    Voir le tableau complet
                  </Button>
                </div>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-violet-600 to-purple-700" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]" />
          <motion.div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 8, repeat: Infinity }} />
          
          <div className="relative mx-auto max-w-4xl px-4 text-center md:px-6">
            <motion.h2 className="text-3xl font-bold text-white md:text-5xl" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              Prêt à réussir votre année ?
            </motion.h2>
            <motion.p className="mx-auto mt-6 max-w-2xl text-lg text-blue-100" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
              Réservez votre place dès maintenant et bénéficiez d'un accompagnement personnalisé pour atteindre vos objectifs.
            </motion.p>
            <motion.div className="mt-10 flex flex-wrap justify-center gap-4" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
              <Button size="lg" className="rounded-full bg-white px-8 text-blue-600 hover:bg-blue-50" onClick={() => document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" })}>
                <Sparkles className="mr-2 h-4 w-4" />
                Choisir ma formule
              </Button>
              <Button size="lg" variant="outline" className="rounded-full border-white/30 bg-white/10 px-8 text-white hover:bg-white/20" onClick={() => setIsContactOpen(true)}>
                <Phone className="mr-2 h-4 w-4" />
                Nous contacter
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <div className="grid gap-8 md:grid-cols-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600">
                    <GraduationCap className="h-4 w-4 text-white" />
                  </div>
                  <span className="font-bold text-slate-900">Nexus Réussite</span>
                </div>
                <p className="mt-4 text-sm text-slate-600">Accompagnement scolaire personnalisé pour la réussite de tous les élèves.</p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Liens rapides</h4>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li><button onClick={() => document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" })} className="hover:text-blue-600">Nos offres</button></li>
                  <li><button onClick={() => setIsTableOpen(true)} className="hover:text-blue-600">Calendrier</button></li>
                  <li><button onClick={() => setIsContactOpen(true)} className="hover:text-blue-600">Contact</button></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Contact</h4>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> +216 XX XXX XXX</li>
                  <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> contact@nexusreussite.tn</li>
                  <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Tunis, Tunisie</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">Newsletter</h4>
                <div className="mt-4 flex gap-2">
                  <Input placeholder="Votre email" className="rounded-xl" />
                  <Button className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600" onClick={() => toast.success("Inscription à la newsletter confirmée !")}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
              © 2026 Nexus Réussite. Tous droits réservés.
            </div>
          </div>
        </footer>

        {/* Scroll to Top */}
        <AnimatePresence>
          {showScrollTop && (
            <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} onClick={scrollToTop} className="fixed bottom-8 right-8 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-110">
              <ChevronUp className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Reservation Dialog */}
        <Dialog open={isReservationOpen} onOpenChange={setIsReservationOpen}>
          <DialogContent className="max-w-lg rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Réserver votre place</DialogTitle>
              <DialogDescription>
                {selectedOffer && (
                  <span className="text-slate-600">
                    Stage : <span className="font-semibold text-slate-900">{selectedOffer.title}</span>
                    <br />
                    Prix : <span className="font-semibold text-slate-900">{selectedOffer.price.toLocaleString("fr-FR")} TND</span>
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nom complet</label>
                <Input placeholder="Votre nom" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" placeholder="votre@email.com" className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Téléphone</label>
                <Input placeholder="+216 XX XXX XXX" className="rounded-xl" />
              </div>
              <div className="rounded-xl bg-blue-50 p-4">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-700">
                    Un acompte de 50% ({selectedOffer ? (selectedOffer.price / 2).toLocaleString("fr-FR") : 0} TND) sera demandé pour confirmer votre inscription.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsReservationOpen(false)}>Annuler</Button>
              <Button className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600" onClick={confirmReservation}>
                Confirmer la réservation
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Full Table Dialog */}
        <Dialog open={isTableOpen} onOpenChange={setIsTableOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] rounded-3xl p-0">
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-2xl flex items-center gap-2">
                <TableIcon className="h-6 w-6" />
                Tableau récapitulatif complet
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[60vh]">
              <div className="p-6">
                <Tabs defaultValue="all">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">Tous</TabsTrigger>
                    <TabsTrigger value="premiere">Première</TabsTrigger>
                    <TabsTrigger value="terminale">Terminale</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all">
                    <UITable>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Horaire</TableHead>
                          <TableHead>Matière</TableHead>
                          <TableHead>Niveau</TableHead>
                          <TableHead>Formule</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{row.date}</TableCell>
                            <TableCell>{row.time}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{row.subject}</Badge></TableCell>
                            <TableCell>{levelLabels[row.level as keyof typeof levelLabels]}</TableCell>
                            <TableCell className="max-w-[250px] truncate">{row.offer}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </UITable>
                  </TabsContent>
                  <TabsContent value="premiere">
                    <UITable>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Horaire</TableHead>
                          <TableHead>Matière</TableHead>
                          <TableHead>Formule</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.filter(r => r.level === "premiere").map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{row.date}</TableCell>
                            <TableCell>{row.time}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{row.subject}</Badge></TableCell>
                            <TableCell className="max-w-[300px] truncate">{row.offer}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </UITable>
                  </TabsContent>
                  <TabsContent value="terminale">
                    <UITable>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Horaire</TableHead>
                          <TableHead>Matière</TableHead>
                          <TableHead>Formule</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.filter(r => r.level === "terminale").map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{row.date}</TableCell>
                            <TableCell>{row.time}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize">{row.subject}</Badge></TableCell>
                            <TableCell className="max-w-[300px] truncate">{row.offer}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </UITable>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
            <div className="border-t border-slate-200 p-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsTableOpen(false)}>Fermer</Button>
              <Button className="bg-gradient-to-r from-blue-600 to-violet-600" onClick={() => toast.info("Export Excel en préparation")}>
                <Download className="mr-2 h-4 w-4" />
                Exporter
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Contact Dialog */}
        <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
          <DialogContent className="max-w-lg rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">Contactez-nous</DialogTitle>
              <DialogDescription>Une question ? Nous sommes là pour vous aider.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium">Téléphone</div>
                  <div className="text-sm text-slate-600">+216 XX XXX XXX</div>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                  <Mail className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-medium">Email</div>
                  <div className="text-sm text-slate-600">contact@nexusreussite.tn</div>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
                  <MapPin className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <div className="font-medium">Adresse</div>
                  <div className="text-sm text-slate-600">Tunis, Tunisie</div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ou envoyez-nous un message</label>
                <textarea className="w-full rounded-xl border border-slate-200 p-3 text-sm min-h-[100px]" placeholder="Votre message..." />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setIsContactOpen(false)}>Annuler</Button>
              <Button className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600" onClick={() => { toast.success("Message envoyé !"); setIsContactOpen(false); }}>
                Envoyer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
