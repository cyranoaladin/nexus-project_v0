"use client";

import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function KorrigoShowcase() {
  return (
    <section
      id="korrigo"
      className="relative w-full text-white bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-deep-midnight via-slate-900 to-deep-midnight"
    >
      <div className="container mx-auto px-4 py-20 md:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ x: -50, opacity: 0 }}
            whileInView={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white mb-6">
              Nos Réalisations : La Preuve par l&apos;Exemple.
            </h2>
            <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed">
              Korrigo et ARIA ne sont pas juste des produits. Ce sont nos
              vitrines technologiques. Elles démontrent notre capacité à
              comprendre un besoin terrain et à déployer une solution IA
              souveraine et performante.
            </p>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-lg bg-brand-accent/10 p-2 text-brand-accent">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-slate-300">
                  <span className="font-semibold text-white">Universel :</span>{" "}
                  Bac Blanc, concours, partiels — compatible avec tout copieur,
                  sans QR Code, sans matériel dédié.
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-lg bg-brand-accent/10 p-2 text-brand-accent">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-slate-300">
                  <span className="font-semibold text-white">Souverain :</span>{" "}
                  Données hébergées localement ou sur Cloud souverain. Conforme
                  RGPD.
                </p>
              </div>
              <div className="flex items-start gap-4">
                <div className="mt-1 rounded-lg bg-brand-accent/10 p-2 text-brand-accent">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-slate-300">
                  <span className="font-semibold text-white">Efficace :</span>{" "}
                  Divisez votre temps de correction et d&apos;administration par
                  2.
                </p>
              </div>
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-semibold text-white mb-4">
                Les modules signature
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-brand-accent text-sm font-semibold mb-1">
                    Smart Ingest Engine™
                  </div>
                  <div className="text-slate-300 text-sm">
                    Scans en vrac, redressement IA, compatible tout copieur.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-brand-accent text-sm font-semibold mb-1">
                    Rapid-ID Desk
                  </div>
                  <div className="text-slate-300 text-sm">
                    Vidéo-codage assisté pour lier copie/élève sans QR Code.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-brand-accent text-sm font-semibold mb-1">
                    Vector Grading Studio
                  </div>
                  <div className="text-slate-300 text-sm">
                    Interface zen, annotations vectorielles, calcul auto.
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-brand-accent text-sm font-semibold mb-1">
                    Universal Data Sync
                  </div>
                  <div className="text-slate-300 text-sm">
                    Liaison native Pronote, Aurion, Apogée.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <a
                href="#contact"
                className="inline-flex h-12 items-center justify-center rounded-full bg-brand-accent px-6 text-sm font-semibold text-black transition-all hover:bg-brand-accent-dark hover:shadow-[0_0_24px_rgba(234,179,8,0.35)]"
              >
                Demander une Démo
              </a>
            </div>
          </motion.div>

          <motion.div
            className="flex items-center justify-center"
            initial={{ scale: 0.9, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            viewport={{ once: true, amount: 0.3 }}
          >
            <div className="relative flex items-center justify-center rounded-2xl bg-white/5 p-8 backdrop-blur-md border border-white/10 shadow-2xl shadow-brand-accent/10">
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-accent/20 blur-[110px]" />
              <motion.div
                className="relative z-10"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Image
                  src="/images/Korrigo.png"
                  alt="Logo Korrigo"
                  width={520}
                  height={520}
                  className="h-auto w-full max-w-md drop-shadow-[0_0_30px_rgba(197,160,89,0.35)]"
                  priority
                />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
