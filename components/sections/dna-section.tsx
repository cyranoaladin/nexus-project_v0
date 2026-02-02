"use client";

import React from "react";
import { motion } from "framer-motion";
import { PenTool, BookOpen, GraduationCap, Code2, Cpu, Blocks } from "lucide-react";

export default function DNASection() {
  return (
    <section id="adn" className="relative py-24 bg-midnight-950">
      <div className="absolute inset-0">
        <div className="absolute left-1/3 top-0 h-72 w-72 rounded-full bg-gold-500/5 blur-[120px]" />
        <div className="absolute right-1/3 bottom-0 h-72 w-72 rounded-full bg-midnight-800/20 blur-[120px]" />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-gold-600/30 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gold-500 backdrop-blur-md">
            Notre ADN Unique
          </div>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold text-white font-serif">
            L&apos;Alliance Terrain × Technologie
          </h2>
          <p className="mt-4 text-slate-300 max-w-2xl mx-auto">
            L&apos;exigence pédagogique d&apos;une équipe terrain, combinée à la rigueur d&apos;un studio d&apos;innovation.
          </p>
        </motion.div>

        <div className="relative grid gap-8 lg:grid-cols-2">
          <div className="absolute left-1/2 top-8 hidden h-[80%] w-px -translate-x-1/2 bg-gradient-to-b from-gold-500/0 via-gold-500/30 to-gold-500/0 lg:block" />

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-3 text-gold-500 mb-6">
              <PenTool className="h-6 w-6" strokeWidth={1.5} />
              <BookOpen className="h-6 w-6" strokeWidth={1.5} />
              <GraduationCap className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold text-white font-serif mb-3">Terrain & Pédagogie</h3>
            <p className="text-slate-400 leading-relaxed">
              Une équipe d&apos;universitaires, agrégés et certifiés avec plus de 25 ans d&apos;expérience cumulée. Nous connaissons la salle de classe car nous y avons enseigné. Des méthodes qui fonctionnent réellement.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl">
            <div className="flex items-center gap-3 text-gold-500 mb-6">
              <Code2 className="h-6 w-6" strokeWidth={1.5} />
              <Cpu className="h-6 w-6" strokeWidth={1.5} />
              <Blocks className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <h3 className="text-2xl font-bold text-white font-serif mb-3">Studio d&apos;Innovation</h3>
            <p className="text-slate-400 leading-relaxed">
              Architectures souveraines, Assistants Intelligents et Web3. Nous ne faisons pas que conseiller, nous bâtissons des outils robustes. Vos données restent chez vous (Souveraineté).
            </p>
          </div>
        </div>

        <div className="mt-10 text-center text-slate-300 font-medium">
          Une équipe bilingue rare : Seulement 1% des acteurs parlent parfaitement ces deux langues.
        </div>
      </div>
    </section>
  );
}
