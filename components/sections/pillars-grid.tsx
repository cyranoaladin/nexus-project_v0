"use client";

import React from "react";
import { Landmark, Compass, ServerCog, Bot, Users, BrainCircuit } from "lucide-react";

const noiseBg =
  "bg-[url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\" viewBox=\"0 0 120 120\"><filter id=\"n\"><feTurbulence type=\"fractalNoise\" baseFrequency=\"0.8\" numOctaves=\"2\" stitchTiles=\"stitch\"/></filter><rect width=\"120\" height=\"120\" filter=\"url(%23n)\" opacity=\"0.25\"/></svg>')]";

export default function PillarsGrid() {
  return (
    <section id="pilliers" className="py-24 bg-midnight-950">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-bold text-white font-serif">
            Une Approche Holistique.
          </h2>
          <p className="mt-4 text-slate-300 max-w-3xl mx-auto">
            Gouvernance, Technologie et Humain : trois leviers indissociables pour l'établissement de demain.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3 lg:grid-rows-2">
          {/* Nexus Stratégie */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl transition hover:border-gold-500/60 hover:bg-white/10">
            <div className={`pointer-events-none absolute inset-0 opacity-[0.06] ${noiseBg}`} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-gold-500 mb-6">
                <Landmark className="h-6 w-6" strokeWidth={1.5} />
                <Compass className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gold-500">
                Nexus Stratégie
              </div>
              <h3 className="mt-2 text-2xl font-bold text-white font-serif">
                Pilotez avec vision.
              </h3>
              <ul className="mt-6 space-y-3 text-slate-400 text-sm">
                <li>• Certification Sécurisée (Smart Credentials)</li>
                <li>• Audit de Maturité Numérique</li>
                <li>• Différenciation concurrentielle</li>
              </ul>
            </div>
          </div>

          {/* Nexus Studio - featured */}
          <div className="relative overflow-hidden rounded-3xl border border-gold-600/40 bg-white/5 p-10 backdrop-blur-md shadow-2xl transition hover:border-gold-500/80 hover:bg-white/10 lg:col-span-2 lg:row-span-2">
            <div className={`pointer-events-none absolute inset-0 opacity-[0.08] ${noiseBg}`} />
            <div className="absolute -top-16 right-10 h-48 w-48 rounded-full bg-gold-500/10 blur-[120px]" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-gold-500 mb-6">
                <ServerCog className="h-6 w-6" strokeWidth={1.5} />
                <Bot className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gold-500">
                Nexus Studio
              </div>
              <h3 className="mt-2 text-3xl font-bold text-white font-serif">
                L'IA qui travaille pour vous.
              </h3>
              <ul className="mt-6 space-y-3 text-slate-300 text-sm md:text-base">
                <li>• Agents Autonomes (Vie scolaire / Tutorat)</li>
                <li>• IA sécurisée avec vos données</li>
                <li>• Korrigo (Correction augmentée)</li>
              </ul>
            </div>
          </div>

          {/* Nexus Academy */}
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl transition hover:border-gold-500/60 hover:bg-white/10">
            <div className={`pointer-events-none absolute inset-0 opacity-[0.06] ${noiseBg}`} />
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-gold-500 mb-6">
                <Users className="h-6 w-6" strokeWidth={1.5} />
                <BrainCircuit className="h-6 w-6" strokeWidth={1.5} />
              </div>
              <div className="text-xs font-semibold uppercase tracking-widest text-gold-500">
                Nexus Academy
              </div>
              <h3 className="mt-2 text-2xl font-bold text-white font-serif">
                Élevez les compétences.
              </h3>
              <ul className="mt-6 space-y-3 text-slate-400 text-sm">
                <li>• Formation Staff (IA & Web3)</li>
                <li>• Cursus Élèves "Elite Track" (Code / Web3)</li>
                <li>• Coaching Orientation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
