"use client";

import React from "react";

export default function CTASection() {
  return (
    <section id="contact" className="py-20 bg-midnight-950 text-white">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-3xl border border-gold-500/30 bg-white/5 p-10 text-center backdrop-blur-md shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
            L'Innovation n'attend pas.
          </h2>
          <p className="mt-4 text-slate-300 text-lg">
            Deux voies pour commencer votre transformation.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-gold-500 to-gold-600 px-8 text-sm font-semibold text-slate-950 shadow-lg hover:shadow-[0_0_24px_rgba(234,179,8,0.3)]"
            >
              Réserver une Démo Korrigo
            </a>
            <a
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-gold-500 px-8 text-sm font-semibold text-white transition hover:bg-gold-500/10"
            >
              Auditer mon Établissement
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
