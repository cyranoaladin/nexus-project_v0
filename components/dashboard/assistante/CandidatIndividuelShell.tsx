'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Power, PowerOff } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { CandidatIndividuelWorkspace } from './CandidatIndividuelWorkspace';
import {
  clearCandidateStudentHandoff,
  tryCandidateStudentHandoffStorage,
} from '@/lib/quotes/candidat-individuel-navigation';

export type CandidatIndividuelStaffRole = 'ADMIN' | 'ASSISTANTE';

interface Props {
  staffRole: CandidatIndividuelStaffRole;
  initialPipelineState: string;
}

type RequestedState = 'OFF' | 'ACTIVE_INTERNAL';

const CONFIG_TARGET = {
  namespace: 'pricing.candidatIndividuelPipeline',
  key: 'state',
} as const;

export function CandidatIndividuelShell({ staffRole, initialPipelineState }: Props) {
  const router = useRouter();
  const [pipelineState, setPipelineState] = useState(initialPipelineState);
  const [pendingState, setPendingState] = useState<RequestedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const active = pipelineState === 'ACTIVE_INTERNAL';
  const off = pipelineState === 'OFF';
  const busy = pendingState !== null;

  useEffect(() => {
    if (!active) {
      tryCandidateStudentHandoffStorage(
        () => window.sessionStorage,
        clearCandidateStudentHandoff,
      );
    }
  }, [active]);

  async function updatePipelineState(value: RequestedState) {
    setPendingState(value);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...CONFIG_TARGET, value }),
      });
      if (!response.ok) throw new Error(`Config update failed (${response.status})`);

      setPipelineState(value);
      setNotice(value === 'ACTIVE_INTERNAL'
        ? "Le simulateur est actif pour l'équipe."
        : 'Le simulateur a été désactivé.');
      router.refresh();
    } catch {
      setError(value === 'ACTIVE_INTERNAL'
        ? "L'activation a échoué. Réessayez."
        : 'La désactivation a échoué. Réessayez.');
    } finally {
      setPendingState(null);
    }
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] space-y-5 text-neutral-100">
      <header className="relative overflow-hidden rounded-micro border border-white/10 bg-surface-card p-5 shadow-sm md:p-6">
        <div className="absolute inset-y-0 right-0 w-48 bg-[radial-gradient(circle_at_center,rgba(201,168,76,0.13),transparent_68%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Outil interne Nexus</p>
            <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Simulateur de devis &mdash; Candidat individuel</h1>
            <p className="mt-2 text-sm leading-6 text-neutral-300">
              Construisez une proposition personnalisée, contrôlez les conditions de publication et remettez à la famille un devis clair et sécurisé.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={active ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/30 bg-amber-300/10 text-amber-100'}>
              {active ? "Actif pour l'équipe" : 'Désactivé'}
            </Badge>
            <Badge variant="outline" className="border-white/15 text-neutral-200">Usage équipe uniquement</Badge>
            {staffRole === 'ADMIN' && active && (
              <Button type="button" variant="outline" disabled={busy} onClick={() => updatePipelineState('OFF')} className="border-white/15 text-white hover:bg-surface-hover">
                {pendingState === 'OFF' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <PowerOff className="mr-2 h-4 w-4" aria-hidden="true" />}
                {pendingState === 'OFF' ? 'Désactivation en cours' : 'Désactiver'}
              </Button>
            )}
          </div>
        </div>
      </header>

      {notice && <div className="rounded-micro border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-50" role="status" aria-live="polite">{notice}</div>}
      {error && <div className="rounded-micro border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-50" role="alert">{error}</div>}

      {active ? (
        <CandidatIndividuelWorkspace staffRole={staffRole} />
      ) : (
        <section className="rounded-micro border border-amber-300/25 bg-amber-300/10 p-6 text-sm text-amber-50" aria-labelledby="pipeline-off-title">
          <h2 id="pipeline-off-title" className="font-semibold">
            {staffRole === 'ADMIN'
              ? 'Le simulateur candidat individuel est désactivé.'
              : "Le simulateur n'est pas encore activé par un administrateur."}
          </h2>
          <p className="mt-2 max-w-2xl text-amber-100/80">Aucune simulation ni création de devis n&apos;est disponible dans cet état.</p>
          {staffRole === 'ADMIN' && off && (
            <Button type="button" disabled={busy} onClick={() => updatePipelineState('ACTIVE_INTERNAL')} className="mt-5 min-h-11 bg-brand-primary text-white hover:bg-brand-primary/90">
              {pendingState === 'ACTIVE_INTERNAL' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Power className="mr-2 h-4 w-4" aria-hidden="true" />}
              {pendingState === 'ACTIVE_INTERNAL'
                ? 'Activation en cours'
                : error
                  ? "Réessayer l'activation"
                  : "Activer pour l'équipe"}
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
