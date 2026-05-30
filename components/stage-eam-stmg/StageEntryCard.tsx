"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calculator, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isPremiereStmg } from "@/content/stage-eam-stmg/eligibility";

const examDate = new Date("2026-06-08T08:00:00+01:00");

export function StageEntryCard({ student }: { student: Record<string, unknown> }) {
  if (!isPremiereStmg(student)) return null;

  const days = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / 86_400_000));

  return (
    <section className="overflow-hidden rounded-card border border-brand-accent/30 bg-surface-card shadow-premium">
      <div className="grid gap-0 md:grid-cols-[minmax(0,0.34fr)_minmax(0,0.66fr)]">
        <div className="flex flex-col justify-between border-b border-white/10 bg-surface-elevated p-5 md:border-b-0 md:border-r">
          <Image
            src="/images/logo_slogan_nexus_x3.png"
            alt="Nexus Réussite"
            width={190}
            height={64}
            className="h-auto w-40"
          />
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-card-sm bg-brand-accent text-surface-darker">
              <Calculator className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase text-brand-accent">Première STMG</p>
              <p className="text-sm text-neutral-300">EAM · 8 juin 2026</p>
            </div>
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-widest text-brand-accent">Stage intensif individualisé</p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                Stage Commando — Épreuve Anticipée de Mathématiques
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300">
                Diagnostic, parcours adaptatif, automatismes sans calculatrice, sujets en conditions et livret imprimable.
              </p>
            </div>
            <div className="rounded-card-sm border border-white/10 bg-surface-darker p-4 text-center">
              <Timer className="mx-auto mb-2 h-5 w-5 text-brand-accent" aria-hidden="true" />
              <p className="text-2xl font-black text-brand-accent">{days}</p>
              <p className="text-xs text-neutral-400">jours restants</p>
            </div>
          </div>
          <Link href="/dashboard/eleve/stage-eam-stmg" className="mt-5 inline-flex w-full sm:w-auto">
            <Button className="w-full bg-brand-accent font-bold text-surface-darker hover:bg-brand-accent/90 sm:w-auto">
              Ouvrir le stage
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
