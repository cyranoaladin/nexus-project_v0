"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DocHit } from "@/components/rag/DocHit";
import { SearchBox } from "@/components/rag/SearchBox";
import { NexusApiClient, type RagHit } from "@/ts_client";

const ROLE_TO_API: Record<string, string> = {
  ELEVE: "student",
  PARENT: "parent",
  COACH: "coach",
  ADMIN: "admin",
  ASSISTANTE: "assistante",
};

function mapRole(role: string) {
  const upper = role.toUpperCase();
  return ROLE_TO_API[upper] ?? "student";
}

interface RagSearchPanelProps {
  actorId: string;
  role: string;
  studentId?: string;
  initialQuery?: string;
  filters?: string;
  emptyMessage?: string;
}

type Hit = {
  documentId: string;
  chunkId: string;
  title: string;
  snippet: string;
  modality: "text" | "image" | "table" | "formula";
  score: number;
};

export function RagSearchPanel({
  actorId,
  role,
  studentId,
  initialQuery,
  filters,
  emptyMessage = "Aucun résultat pour cette recherche.",
}: RagSearchPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Hit[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const apiClient = useMemo(() => new NexusApiClient({ baseUrl: "/pyapi" }), []);
  const apiRole = useMemo(() => mapRole(role), [role]);

  const headers = useMemo(() => {
    const data: Record<string, string> = {
      "X-Role": apiRole,
      "X-Actor-Id": actorId,
    };
    if (studentId) {
      data["X-Student-Id"] = studentId;
    }
    return data;
  }, [actorId, apiRole, studentId]);

  const performSearch = useCallback(
    async (rawQuery: string) => {
      const query = rawQuery.trim();
      setError(null);
      setHasSearched(true);
      if (!query) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      try {
        const response = await apiClient.rag.search(query, {
          filters,
          headers,
        });
        const hits: Hit[] = (response.hits ?? []).map((hit: RagHit, index: number) => {
          const fallback = (hit as unknown as Record<string, unknown>) ?? {};
          const rawModality = hit.metadata?.modality ?? fallback.modality ?? "text";
          const modality = typeof rawModality === "string" ? rawModality.toLowerCase() : "text";
          const normalizedModality: Hit["modality"] =
            modality === "image" || modality === "table" || modality === "formula"
              ? modality
              : "text";
          const titleFallback = fallback.title ?? hit.metadata?.title;
          const title = typeof titleFallback === "string" ? titleFallback : `Document ${index + 1}`;
          const snippetFallback = fallback.snippet ?? fallback.preview ?? hit.metadata?.summary;
          const snippet = typeof snippetFallback === "string" ? snippetFallback : "Extrait indisponible.";
          const rawScore = typeof hit.score === "number" ? hit.score : fallback.score;
          const score = (() => {
            if (typeof rawScore === "number") {
              return rawScore;
            }
            if (typeof rawScore === "string") {
              const parsed = Number(rawScore);
              return Number.isFinite(parsed) ? parsed : 0;
            }
            return 0;
          })();
          return {
            documentId: hit.document_id,
            chunkId: hit.chunk_id,
            title,
            snippet,
            modality: normalizedModality,
            score: Number.isFinite(score) ? Math.max(Math.min(score, 1), 0) : 0,
          };
        });
        setResults(hits);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Recherche indisponible";
        setError(message);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [apiClient, filters, headers],
  );

  useEffect(() => {
    if (!initialQuery) return;
    void performSearch(initialQuery);
  }, [initialQuery, performSearch]);

  return (
    <div className="space-y-4">
      <SearchBox onSearch={performSearch} />
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100"
            />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((hit) => (
            <DocHit
              key={`${hit.documentId}-${hit.chunkId}`}
              documentId={hit.documentId}
              chunkId={hit.chunkId}
              title={hit.title}
              snippet={hit.snippet}
              modality={hit.modality}
              score={hit.score}
            />
          ))}
        </div>
      ) : hasSearched ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
          {emptyMessage}
        </p>
      ) : null}
    </div>
  );
}
