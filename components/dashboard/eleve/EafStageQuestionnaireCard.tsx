'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type QuestionnaireStatus = 'not_started' | 'draft' | 'submitted' | 'loading';

/**
 * Dashboard card for the EAF Spring Stage Questionnaire.
 * Visible only for Première students (guard applied by parent).
 */
export function EafStageQuestionnaireCard() {
  const [status, setStatus] = useState<QuestionnaireStatus>('loading');

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/eleve/questionnaire-eaf-stage-printemps');
        if (!res.ok) {
          setStatus('not_started');
          return;
        }
        const data = await res.json();
        if (!data.bilan) {
          setStatus('not_started');
        } else {
          const bilanStatus = data.bilan.status;
          setStatus(bilanStatus === 'COMPLETED' ? 'submitted' : 'draft');
        }
      } catch {
        setStatus('not_started');
      }
    }
    void fetchStatus();
  }, []);

  const statusConfig: Record<Exclude<QuestionnaireStatus, 'loading'>, { label: string; color: string }> = {
    not_started: {
      label: 'À compléter',
      color: 'bg-amber-500/15 text-amber-200 border-amber-500/20',
    },
    draft: {
      label: 'Brouillon enregistré',
      color: 'bg-blue-500/15 text-blue-200 border-blue-500/20',
    },
    submitted: {
      label: 'Envoyé',
      color: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/20',
    },
  };

  const currentStatus = status === 'loading' ? null : statusConfig[status];

  return (
    <Card className="bg-gradient-to-br from-cyan-500/10 via-brand-accent/5 to-surface-card border border-cyan-500/20 shadow-lg overflow-hidden group mb-6">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row items-stretch">
          {/* Left panel */}
          <div className="md:w-1/3 bg-cyan-500/10 p-6 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-cyan-500/20">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <FileText className="w-8 h-8 text-cyan-300" />
            </div>
            <h3 className="font-bold text-white tracking-tight">Auto-évaluation EAF</h3>
            <p className="text-[10px] uppercase tracking-widest text-cyan-300/70 font-bold mt-1">
              Stage de printemps
            </p>
          </div>

          {/* Right panel */}
          <div className="flex-1 p-6 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-400/10 text-cyan-300 border border-cyan-300/20 px-2 py-0.5 rounded-full">
                Première
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-400/10 text-violet-300 border border-violet-300/20 px-2 py-0.5 rounded-full">
                Écrit de français
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-300/20 px-2 py-0.5 rounded-full">
                Après-stage
              </span>
            </div>

            <h4 className="text-lg font-bold text-white mb-2">
              Mon retour d'expérience – Écrit de français
            </h4>
            <p className="text-sm text-neutral-400 mb-4 line-clamp-2">
              Évalue ta progression sur le commentaire, la dissertation, la méthode, l&apos;expression écrite et la suite de ton travail après les 16h de préparation à l&apos;EAF.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <Link href="/dashboard/eleve/questionnaires/eaf-stage-printemps" className="w-full sm:w-fit">
                <Button className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 shadow-lg shadow-cyan-600/20">
                  {status === 'submitted' ? 'Voir mes réponses' : 'Compléter le questionnaire'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>

              {status === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
              ) : currentStatus ? (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border ${currentStatus.color}`}>
                  {status === 'submitted' && <CheckCircle2 className="w-3 h-3" />}
                  {currentStatus.label}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
