"use client";

import React from "react";
import Link from "next/link";

export function CorporateNavbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-deep-midnight/80 backdrop-blur-md transition-all">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-bold text-xl tracking-tighter text-white"
        >
          <img
            src="/images/logo_slogan_nexus_x3.png"
            alt="Nexus Réussite"
            className="h-10 w-auto"
          />
        </Link>
        <div className="hidden xl:flex gap-8 text-sm font-medium text-slate-300">
          <Link href="/#adn" className="hover:text-gold-400 transition-colors">
            Expertise
          </Link>
          <Link
            href="/#etablissements"
            className="hover:text-gold-400 transition-colors"
          >
            Pour les Écoles
          </Link>
          <Link
            href="/#parents_eleves"
            className="hover:text-gold-400 transition-colors"
          >
            Parents & Élèves
          </Link>
          <Link href="/offres" className="hover:text-gold-400 transition-colors">
            Offres & Tarifs
          </Link>
          <Link
            href="/#formation_tech"
            className="hover:text-gold-400 transition-colors"
          >
            Formation Pro
          </Link>
          <Link href="/#korrigo" className="hover:text-gold-400 transition-colors">
            Korrigo
          </Link>
        </div>
        <div className="flex gap-4">
          <Link
            href="/contact"
            className="inline-flex h-10 items-center justify-center rounded-full bg-gold-500 px-6 text-sm font-medium text-black shadow-lg transition-all hover:bg-gold-400 hover:scale-105 focus:outline-none"
          >
            Contact / Audit
          </Link>
        </div>
      </div>
    </nav>
  );
}
