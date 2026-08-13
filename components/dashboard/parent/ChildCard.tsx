"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { AlertTriangle,ArrowRight,Calendar,Check,Copy,KeyRound,Loader2,User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export interface ParentDashboardChild {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    gradeLevel: string;
    academicTrack: string;
    activationStatus: 'PENDING_ACTIVATION' | 'ACTIVE';
    activationExpiresAt: string | null;
    /** État du lien parent-élève canonique — VERIFIED = bilans visibles. */
    consentState?: 'PENDING_PARENT_CONSENT' | 'VERIFIED' | 'REVOKED' | 'EXPIRED' | 'MISSING';
    nexusIndex?: number;
    nextSession?: {
      subject: string;
      scheduledAt: string;
    } | null;
    alerts?: string[];
    lastBilanDate?: string | null;
    subscriptionDetails?: { monthlyPrice?: number } | null;
    progressionHistory?: Array<{ date: string; nexusIndex: number; ssn: number; uai: number }>;
    sessions?: Array<{
      id: string;
      subject: string;
      scheduledAt: string;
      coachName: string;
    }>;
    subscription?: string | null;
}

interface ChildCardProps {
  child: ParentDashboardChild;
}

export function ChildCard({ child }: ChildCardProps) {
  const hasAlerts = child.alerts && child.alerts.length > 0;
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationError, setActivationError] = useState(false);
  const [activation, setActivation] = useState<null | {
    activationUrl: string;
    expiresAt: string;
    loginIdentifier: string;
  }>(null);
  const [copied, setCopied] = useState(false);

  const issueActivation = async () => {
    setActivationLoading(true);
    setActivationError(false);
    try {
      const response = await fetch(`/api/parent/children/${encodeURIComponent(child.id)}/activation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('ACTIVATION_UNAVAILABLE');
      const body = await response.json() as { activation?: typeof activation };
      if (!body.activation) throw new Error('ACTIVATION_UNAVAILABLE');
      setActivation(body.activation);
      setCopied(false);
    } catch {
      setActivation(null);
      setActivationError(true);
    } finally {
      setActivationLoading(false);
    }
  };

  return (
    <Card className="bg-surface-card border-white/10 hover:border-brand-accent/40 transition-all group overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent">
              <User className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-white text-lg">{child.firstName}</CardTitle>
              <p className="text-xs text-neutral-300">
                {child.gradeLevel} • {child.academicTrack.replace('_', ' ')}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-neutral-300 font-bold">NexusIndex</p>
            <p className={`text-xl font-bold ${child.nexusIndex ? 'text-brand-accent' : 'text-neutral-600'}`}>
              {child.nexusIndex ?? '--'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerts */}
        {hasAlerts && (
          <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="text-xs text-rose-200 truncate">{child.alerts![0]}</span>
          </div>
        )}

        {/* Prochaine Session */}
        <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-accent" />
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-300 uppercase font-bold">Prochaine séance</span>
              <span className="text-xs text-white truncate max-w-[120px]">
                {child.nextSession?.subject ?? 'Aucune programmée'}
              </span>
            </div>
          </div>
          {child.nextSession && (
            <span className="text-[10px] text-neutral-300">
              {new Date(child.nextSession.scheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </div>

        {child.consentState !== undefined && child.consentState !== 'VERIFIED' && (
          // Le consentement conditionne l'accès aux bilans : il passe AVANT
          // l'invitation à activer le compte élève, qui ne débloque rien.
          <Link
            href={`/dashboard/parent/enfant/${encodeURIComponent(child.id)}`}
            className="block rounded-lg border border-lux-gold/40 bg-lux-gold/10 p-3 transition hover:bg-lux-gold/15"
          >
            <p className="text-xs font-semibold text-amber-100">
              Les bilans de {child.firstName} attendent votre accord
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-300">
              Une seule étape : confirmez votre consentement sur la fiche de
              votre enfant pour voir ses bilans dès leur diffusion.
            </p>
          </Link>
        )}

        {child.activationStatus === 'PENDING_ACTIVATION' && (
          <div className="space-y-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-amber-100">Compte élève à activer</p>
                <p className="text-xs text-neutral-300">Le lien est réservé à cet enfant et expire après 72 heures.</p>
              </div>
              <KeyRound className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full border-amber-300/30 text-amber-100 hover:bg-amber-300/10"
              disabled={activationLoading}
              onClick={issueActivation}
            >
              {activationLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Activer le compte élève
            </Button>
            {activationError ? (
              <p role="alert" className="text-xs text-rose-200">Activation indisponible. Réessayez sans partager d’identifiant.</p>
            ) : null}
            {activation ? (
              <div className="space-y-2 rounded-md bg-black/20 p-3 text-xs text-neutral-200">
                <p>Identifiant de connexion : <span className="font-semibold text-white">{activation.loginIdentifier}</span></p>
                <p>Remettez ce lien à votre enfant pour qu'il passe son bilan.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={activation.activationUrl} className="h-9 min-w-0 font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label="Copier le lien"
                    onClick={() => {
                      void navigator.clipboard?.writeText(activation.activationUrl);
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
                    {copied ? 'Copié' : 'Copier'}
                  </Button>
                </div>
                <a
                  href={activation.activationUrl}
                  className="inline-flex font-semibold text-brand-accent underline underline-offset-4"
                >
                  Ouvrir l’activation
                </a>
              </div>
            ) : null}
          </div>
        )}

        {/* Action Button */}
        <Link href={`/dashboard/parent/enfant/${child.id}`} className="block w-full">
          <Button variant="outline" className="w-full border-white/10 text-neutral-100 hover:bg-brand-accent hover:text-white group">
            Voir la progression
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
