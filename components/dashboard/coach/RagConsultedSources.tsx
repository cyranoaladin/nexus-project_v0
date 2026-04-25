"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ExternalLink } from "lucide-react";

export interface RagSource {
  id: string;
  title: string;
  url?: string;
  consultedAt: string | Date;
  /** Confidence or relevance score (0-1), optional. */
  score?: number;
}

interface RagConsultedSourcesProps {
  sources: RagSource[];
  className?: string;
}

/**
 * Phase 6 — Affiche les sources RAG consultées récemment par un élève.
 * Ce composant est purement présentationnel ; le tracking des sources
 * consultées est à implémenter côté serveur (table `RagConsultationLog`
 * ou champ JSON sur `AriaConversation`).
 *
 * Lorsque `sources` est vide, un message d'état invite à enrichir le
 * pipeline RAG (cf. docs/STMG_CONTENT_ROADMAP.md).
 */
export function RagConsultedSources({ sources, className }: RagConsultedSourcesProps) {
  return (
    <Card className={`bg-surface-card border-white/10 shadow-premium ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-300" />
          Sources RAG consultées
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sources.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-neutral-500 italic">
              Aucune source RAG tracée pour cet élève.
            </p>
            <p className="text-[10px] text-neutral-600 mt-1">
              Les chunks ingérés et les réponses ARIA enrichies apparaîtront ici
              une fois le pipeline de tracking activé.
            </p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {sources.map((source) => {
              const consulted =
                typeof source.consultedAt === "string"
                  ? new Date(source.consultedAt)
                  : source.consultedAt;
              return (
                <li
                  key={source.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
                >
                  <FileText
                    className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-neutral-200 truncate">
                        {source.title}
                      </p>
                      {source.url && (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-neutral-500 hover:text-brand-accent transition-colors"
                          aria-label={`Ouvrir ${source.title}`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-neutral-500">
                        {consulted.toLocaleDateString("fr-FR", {
                          dateStyle: "short",
                        })}
                      </span>
                      {typeof source.score === "number" && (
                        <span
                          className={`text-[10px] px-1 rounded ${
                            source.score >= 0.8
                              ? "bg-emerald-500/10 text-emerald-400"
                              : source.score >= 0.5
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-neutral-500/10 text-neutral-400"
                          }`}
                        >
                          pert. {Math.round(source.score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
