"use client";

import { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History, BookOpen } from "lucide-react";
import { ProgressEvolutionChart } from "@/components/dashboard/parent/ProgressEvolutionChart";
import {
  PedagogicalAlertsFeed,
  type PedagogicalAlert,
} from "./PedagogicalAlertsFeed";
import { CoachNotesPanel, type CoachNote } from "./CoachNotesPanel";
import { AriaVerbatimsPanel, type AriaVerbatim } from "./AriaVerbatimsPanel";
import { RagConsultedSources, type RagSource } from "./RagConsultedSources";

export interface DossierStudent {
  id: string;
  name: string;
  email?: string;
  gradeLevel?: string;
  academicTrack?: string;
  specialties?: string[];
  stmgPathway?: string | null;
  nexusIndex?: number | null;
  status?: "STABLE" | "WARNING" | "CRITICAL";
}

export interface DossierSession {
  id: string;
  date: string | Date;
  subject: string;
  notes?: string;
  rapportUrl?: string;
}

export interface DossierData {
  student: DossierStudent;
  progressionHistory: Array<{ date: string; nexusIndex: number; ssn: number; uai: number }>;
  recentSessions: DossierSession[];
  pedagogicalAlerts: PedagogicalAlert[];
  verbatims: AriaVerbatim[];
  ragSources: RagSource[];
  notes: CoachNote[];
  bilanCount: number;
  ariaConversationCount: number;
  /** If the student is under 16, verbatims may be redacted. */
  studentIsMinor?: boolean;
}

interface StudentDossierProps {
  data: DossierData;
  /** Extra content injected between the two main columns (e.g. TrajectoryDesigner). */
  children?: ReactNode;
}

/**
 * Phase 6 — Dossier complet d'un élève, vu par le coach.
 *
 * Reprend la structure "parent read-only" (ProgressEvolutionChart,
 * historique des séances, ressources) et ajoute les composants coach
 * spécifiques : alertes pédagogiques, verbatims ARIA, sources RAG,
 * notes privées.
 *
 * La disposition est responsive :
 * - Desktop : grille 2 colonnes (2/3 + 1/3)
 * - Mobile : empilement vertical
 */
export function StudentDossier({ data, children }: StudentDossierProps) {
  const { student, progressionHistory, recentSessions, pedagogicalAlerts, verbatims, ragSources, notes, studentIsMinor } = data;

  return (
    <div className="space-y-6">
      {/* KPI bar */}
      <div className="flex flex-wrap gap-3">
        <Kpi label="NexusIndex" value={student.nexusIndex?.toString() ?? "—"} accent="brand-accent" />
        <Kpi label="Bilans" value={data.bilanCount.toString()} accent="emerald-400" />
        <Kpi label="Conv. ARIA" value={data.ariaConversationCount.toString()} accent="cyan-300" />
        <Kpi
          label="Filière"
          value={student.academicTrack?.replace(/_/g, " ") ?? "—"}
          accent="neutral-300"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === Left column (2/3) === */}
        <div className="lg:col-span-2 space-y-6">
          <ProgressEvolutionChart data={progressionHistory} />

          {/* Historique des séances */}
          <Card className="bg-surface-card border-white/10 shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <History className="w-4 h-4 text-brand-accent" />
                Historique des séances
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSessions.length === 0 ? (
                <p className="text-xs text-neutral-500 italic">
                  Aucune séance récente.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentSessions.map((session) => {
                    const date =
                      typeof session.date === "string"
                        ? new Date(session.date)
                        : session.date;
                    return (
                      <li
                        key={session.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div>
                          <p className="text-xs text-neutral-200">
                            {session.subject}
                          </p>
                          <p className="text-[10px] text-neutral-500">
                            {date.toLocaleDateString("fr-FR", {
                              dateStyle: "short",
                            })}
                          </p>
                        </div>
                        {session.rapportUrl ? (
                          <a
                            href={session.rapportUrl}
                            className="text-[10px] text-brand-accent hover:underline"
                          >
                            Rapport
                          </a>
                        ) : (
                          <span className="text-[10px] text-neutral-600">
                            Sans rapport
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Ressources assignées — placeholder structuré */}
          <Card className="bg-surface-card border-white/10 shadow-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                Ressources assignées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-neutral-500 italic">
                Les ressources pédagogiques (livrets, QCM, fiches) assignées par
                le coach à cet élève seront listées ici une fois le système
                d'assignation activé.
              </p>
            </CardContent>
          </Card>

          {/* Optional children (TrajectoryDesigner, etc.) */}
          {children}
        </div>

        {/* === Right column (1/3) === */}
        <div className="space-y-6">
          <PedagogicalAlertsFeed alerts={pedagogicalAlerts} />

          <CoachNotesPanel
            studentId={student.id}
            initialNotes={notes}
          />

          <AriaVerbatimsPanel
            verbatims={verbatims}
            studentIsMinor={studentIsMinor}
          />

          <RagConsultedSources sources={ragSources} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helper : pastille KPI                                               */
/* ------------------------------------------------------------------ */
function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="bg-surface-card border border-white/10 px-4 py-2 rounded-xl">
      <p className="text-[10px] uppercase text-neutral-500 font-bold mb-0.5">
        {label}
      </p>
      <p className={`text-lg font-bold ${accent.startsWith("text-") ? accent : `text-${accent}`}`}>
        {value}
      </p>
    </div>
  );
}
