"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const STATS = [
  {
    id: "experience",
    value: 150,
    suffix: "+",
    label: "Années d'Expérience",
    description: "Cumulées par notre équipe d'experts"
  },
  {
    id: "experts",
    value: 25,
    suffix: "+",
    label: "Experts Certifiés",
    description: "Agrégés et Certifiés de l'Éducation Nationale"
  },
  {
    id: "success",
    value: 95,
    suffix: "%",
    label: "Taux de Réussite",
    description: "De nos élèves au Baccalauréat"
  }
];

function AnimatedCounter({ value, suffix = "", duration = 2000 }: { value: number; suffix?: string; duration?: number; }) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!hasAnimated) return;

    const startTime = Date.now();
    const startValue = 0;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function pour un effet plus naturel
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (value - startValue) * easeOut);

      setCount(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [value, duration, hasAnimated]);

  return (
    <motion.span
      className="font-bold text-4xl md:text-5xl lg:text-6xl text-white"
      initial={{ opacity: 0 }}
      whileInView={{
        opacity: 1,
        transition: { duration: 0.6 }
      }}
      onViewportEnter={() => setHasAnimated(true)}
      viewport={{ once: true }}
    >
      {count}{suffix}
    </motion.span>
  );
}

export function ExpertsHighlightSection() {
  return (
    <section
      className="relative py-24 overflow-hidden"
      style={{
        backgroundImage: "url('/images/BackgroundImage_EquipeStrategique.png')",
        backgroundSize: "cover",
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat"
      }}
    >
      {/* Superposition sombre pour la lisibilité */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950/85 via-blue-950/75 to-slate-900/85"
        style={{ zIndex: 1 }}
      ></div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative" style={{ zIndex: 2 }}>
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="outline" className="bg-white/10 text-white border-white/20 mb-6">
            <Users className="w-4 h-4 mr-2" />
            Notre Force
          </Badge>
          <h2 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-8 leading-tight">
            L'Excellence de nos <span className="text-blue-300">Experts</span>
          </h2>
          <p className="text-xl md:text-2xl text-blue-100 max-w-4xl mx-auto leading-relaxed">
            Notre équipe d'élite réunit les meilleurs talents de l'enseignement français.
            Découvrez les chiffres qui témoignent de notre expertise exceptionnelle.
          </p>
        </motion.div>

        {/* Statistiques avec animation de comptage */}
        <div className="grid md:grid-cols-3 gap-12 mb-16">
          {STATS.map((stat, index) => (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="mb-4">
                <AnimatedCounter value={stat.value} suffix={stat.suffix} />
              </div>
              <h3 className="font-heading text-2xl md:text-3xl font-bold text-white mb-3">
                {stat.label}
              </h3>
              <p className="text-blue-200 text-lg leading-relaxed">
                {stat.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 md:p-12 border border-white/20">
            <h3 className="font-heading text-3xl md:text-4xl font-bold text-white mb-6">
              Rencontrez l'Équipe qui Transforme les Destins
            </h3>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              Chaque expert de notre équipe a été rigoureusement sélectionné pour son excellence pédagogique
              et sa capacité à révéler le potentiel de chaque élève.
            </p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white h-16 px-8 text-lg font-semibold group shadow-xl">
              <Link href="/equipe">
                Découvrir notre équipe
                <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Effet de particules subtil */}
      <div className="absolute inset-0 opacity-30" style={{ zIndex: 1 }}>
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 left-3/4 w-1 h-1 bg-white rounded-full animate-ping"></div>
        <div className="absolute top-1/2 left-1/6 w-1.5 h-1.5 bg-blue-200 rounded-full animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-white rounded-full animate-ping"></div>
      </div>
    </section>
  );
}
