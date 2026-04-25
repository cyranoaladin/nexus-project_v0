"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Bot, User } from "lucide-react";

export interface AriaVerbatim {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string | Date;
  /** Optional truncated/redacted version for minors (< 16 ans). */
  redacted?: boolean;
}

interface AriaVerbatimsPanelProps {
  verbatims: AriaVerbatim[];
  /** If true, the panel applies a soft anonymization warning. */
  studentIsMinor?: boolean;
  className?: string;
}

/**
 * Phase 6 — Affiche les derniers échanges ARIA d'un élève (lecture seule
 * pour le coach). Conformément au plan, si l'élève est mineur (< 16 ans),
 * le panneau affiche un avertissement et masque les contenus marqués
 * `redacted: true`.
 */
export function AriaVerbatimsPanel({
  verbatims,
  studentIsMinor,
  className,
}: AriaVerbatimsPanelProps) {
  return (
    <Card className={`bg-surface-card border-white/10 shadow-premium ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-300" />
          Verbatims ARIA récents
        </CardTitle>
      </CardHeader>
      <CardContent>
        {studentIsMinor && (
          <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 p-2 rounded mb-3">
            Élève mineur — verbatims partiellement anonymisés conformément à la
            politique de confidentialité.
          </p>
        )}
        {verbatims.length === 0 ? (
          <p className="text-xs text-neutral-500 italic">
            Aucun échange ARIA récent.
          </p>
        ) : (
          <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {verbatims.map((v) => {
              const Icon = v.role === "user" ? User : Bot;
              const created =
                typeof v.createdAt === "string" ? new Date(v.createdAt) : v.createdAt;
              return (
                <li
                  key={v.id}
                  className={`p-2 rounded-lg border text-xs ${
                    v.role === "user"
                      ? "bg-white/5 border-white/10"
                      : "bg-cyan-500/5 border-cyan-500/20"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon
                      className={`w-3 h-3 ${
                        v.role === "user" ? "text-neutral-400" : "text-cyan-300"
                      }`}
                      aria-hidden="true"
                    />
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wide">
                      {v.role === "user" ? "Élève" : "ARIA"} ·{" "}
                      {created.toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-neutral-200 whitespace-pre-wrap">
                    {studentIsMinor && v.redacted
                      ? "[contenu masqué — élève mineur]"
                      : v.content}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
