import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Cockpit ARIA — Nexus Réussite',
  description: "Espace d'accompagnement académique augmenté par IA pédagogique socratique.",
};

export default function AriaCockpitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Cockpit Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/eleve"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
            title="Retour au tableau de bord"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <Link href="/dashboard/eleve/aria" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-semibold text-sm text-slate-200 tracking-tight">
              Cockpit ARIA
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            Nexus Socratique V1
          </span>
        </div>
      </header>

      {/* Main Cockpit Body */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
