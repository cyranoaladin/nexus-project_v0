"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Pin, Plus, StickyNote } from "lucide-react";

export interface CoachNote {
  id: string;
  body: string;
  pinned: boolean;
  coachId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface CoachNotesPanelProps {
  studentId: string;
  /** Optional initial notes for SSR; otherwise fetched on mount. */
  initialNotes?: CoachNote[];
  className?: string;
}

const MAX_LEN = 4000;

/**
 * Phase 6 — Panneau de notes privées coach pour un élève donné.
 * Consomme `/api/coach/students/[studentId]/notes` (GET, POST).
 * RBAC est appliqué côté serveur (un coach ne voit que ses propres notes
 * sur ses élèves rattachés).
 */
export function CoachNotesPanel({ studentId, initialNotes, className }: CoachNotesPanelProps) {
  const [notes, setNotes] = useState<CoachNote[]>(initialNotes ?? []);
  const [loading, setLoading] = useState<boolean>(!initialNotes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pinDraft, setPinDraft] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/students/${studentId}/notes`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { notes: CoachNote[] };
      setNotes(json.notes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (initialNotes) return;
    void fetchNotes();
  }, [fetchNotes, initialNotes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/students/${studentId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, pinned: pinDraft }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      const { note } = (await res.json()) as { note: CoachNote };
      setNotes((prev) => [note, ...prev]);
      setDraft("");
      setPinDraft(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className={`bg-surface-card border-white/10 shadow-premium ${className ?? ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-amber-300" />
          Notes privées
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <label htmlFor={`coach-note-${studentId}`} className="sr-only">
            Nouvelle note
          </label>
          <textarea
            id={`coach-note-${studentId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
            rows={3}
            placeholder="Observation pédagogique, point de vigilance, action prévue…"
            className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-brand-accent/40 resize-y"
            disabled={submitting}
            maxLength={MAX_LEN}
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer">
              <input
                type="checkbox"
                checked={pinDraft}
                onChange={(e) => setPinDraft(e.target.checked)}
                className="accent-brand-accent"
              />
              Épingler en haut
            </label>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || draft.trim().length === 0}
              className="text-xs"
            >
              {submitting ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
              Ajouter
            </Button>
          </div>
        </form>

        {error && (
          <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2 rounded">
            {error}
          </p>
        )}

        <div className="space-y-2">
          {loading ? (
            <p className="text-xs text-neutral-500 italic flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Chargement…
            </p>
          ) : notes.length === 0 ? (
            <p className="text-xs text-neutral-500 italic">Aucune note pour cet élève.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => {
                const created =
                  typeof note.createdAt === "string" ? new Date(note.createdAt) : note.createdAt;
                return (
                  <li
                    key={note.id}
                    className={`p-3 rounded-lg border text-xs ${
                      note.pinned
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">
                        {created.toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                      {note.pinned && (
                        <Pin className="w-3 h-3 text-amber-400" aria-label="Note épinglée" />
                      )}
                    </div>
                    <p className="text-neutral-200 whitespace-pre-wrap">{note.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
