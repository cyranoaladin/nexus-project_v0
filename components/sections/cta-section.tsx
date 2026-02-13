"use client";

import React from "react";

export default function CTASection() {
  return (
    <section id="contact" className="py-20 bg-surface-darker text-white">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-4xl rounded-3xl border border-brand-accent/30 bg-white/5 p-10 text-center backdrop-blur-md shadow-2xl">
          <h2 className="marketing-section-title">
            L'Innovation n'attend pas.
          </h2>
          <p className="marketing-section-copy">
            Deux voies pour commencer votre transformation.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-brand-accent to-brand-accent-dark px-8 text-sm font-semibold text-surface-dark shadow-lg hover:shadow-[0_0_24px_rgba(46,233,246,0.3)]"
            >
              Réserver une Démo Korrigo
            </a>
            <a
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-brand-accent px-8 text-sm font-semibold text-white transition hover:bg-brand-accent/10"
            >
              Auditer mon Établissement
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
