"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BookOpen, Plus, FileText, Globe, Eye } from "lucide-react";

export interface UserDocument {
  id: string;
  title: string;
  documentType: string;
  subject?: string;
  localPath: string;
  description?: string;
  createdAt: string | Date;
}

interface CoachDocumentsPanelProps {
  studentId: string;
  className?: string;
}

export function CoachDocumentsPanel({ studentId, className }: CoachDocumentsPanelProps) {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("COURS");
  const [subject, setSubject] = useState("MATHEMATIQUES");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [visibilityScope, setVisibilityScope] = useState("STUDENT_AND_COACH");

  // Fetch coach's assigned students for multi-selection
  const [allStudents, setAllStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([studentId]);

  const fetchData = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch documents for this student
      const res = await fetch(`/api/coach/students/${studentId}/documents`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setDocuments(json.documents || []);

      // 2. Fetch all of the coach's students to allow assigning to multiple students
      const dashRes = await fetch("/api/coach/dashboard");
      if (dashRes.ok) {
        const dashJson = await dashRes.json();
        setAllStudents(dashJson.students || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRecipientToggle = (sId: string) => {
    setSelectedRecipientIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!url.trim() && !file) {
      setError("Veuillez fournir une URL ou sélectionner un fichier.");
      return;
    }
    if (selectedRecipientIds.length === 0) {
      setError("Veuillez sélectionner au moins un élève destinataire.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Upload for each selected student
      for (const targetStudentId of selectedRecipientIds) {
        if (file) {
          // Upload file using FormData
          const formData = new FormData();
          formData.append("file", file);
          formData.append("title", title);
          formData.append("documentType", documentType);
          formData.append("subject", subject);
          formData.append("visibilityScope", visibilityScope);

          const res = await fetch(`/api/coach/students/${targetStudentId}/documents`, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || payload.message || `HTTP ${res.status}`);
          }
        } else {
          // Upload using URL
          const res = await fetch(`/api/coach/students/${targetStudentId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title,
              documentType,
              subject,
              url,
              visibilityScope,
            }),
          });

          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error(payload.error || payload.message || `HTTP ${res.status}`);
          }
        }
      }

      // Re-fetch documents to update current view
      await fetchData();

      // Reset fields but keep recipients
      setTitle("");
      setUrl("");
      setFile(null);
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
          <BookOpen className="w-4 h-4 text-emerald-400" />
          Ressources assignées
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form to assign a new document */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-accent" />
            Déposer une nouvelle ressource
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Titre</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Corrigé Épreuve 2026, Fiche de révision"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-brand-accent/40"
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">URL du document (optionnel)</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Lien externe ou hébergé (Google Drive, Dropbox...)"
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-brand-accent/40"
                disabled={submitting || !!file}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Ou importer depuis votre machine</label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-neutral-100 focus:outline-none focus:border-brand-accent/40"
                disabled={submitting || !!url}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Type de document</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-neutral-100 focus:outline-none focus:border-brand-accent/40 cursor-pointer"
                disabled={submitting}
              >
                <option value="COURS">Cours</option>
                <option value="EXERCICE">Exercice</option>
                <option value="BILAN">Bilan</option>
                <option value="CORRECTION">Correction</option>
                <option value="PLANNING">Planning</option>
                <option value="ANNEXE">Annexe</option>
                <option value="AUTRE">Autre</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400">Matière</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-neutral-100 focus:outline-none focus:border-brand-accent/40 cursor-pointer"
                disabled={submitting}
              >
                <option value="MATHEMATIQUES">Mathématiques</option>
                <option value="FRANCAIS">Français</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-neutral-400">Visibilité</label>
              <select
                value={visibilityScope}
                onChange={(e) => setVisibilityScope(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-neutral-100 focus:outline-none focus:border-brand-accent/40 cursor-pointer"
                disabled={submitting}
              >
                <option value="STUDENT_ONLY">Élève uniquement</option>
                <option value="STUDENT_AND_PARENT">Élève & Parent</option>
                <option value="STUDENT_AND_COACH">Élève & Coach</option>
                <option value="STUDENT_PARENT_COACH">Élève, Parent & Coach</option>
              </select>
            </div>

            {/* Recipients Multi-select Section */}
            {allStudents.length > 1 && (
              <div className="space-y-1.5 md:col-span-2 bg-white/5 border border-white/5 p-3 rounded-xl mt-1">
                <label className="text-xs font-medium text-white flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-brand-accent" />
                  Sélectionner les élèves destinataires
                </label>
                <p className="text-[10px] text-neutral-500 mb-2">
                  Sélectionnez les élèves qui recevront cette ressource.
                </p>
                <div className="flex flex-wrap gap-2">
                  {allStudents.map((s) => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-all select-none ${
                        selectedRecipientIds.includes(s.id)
                          ? "bg-brand-accent/15 border-brand-accent text-brand-accent font-medium"
                          : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:text-neutral-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRecipientIds.includes(s.id)}
                        onChange={() => handleRecipientToggle(s.id)}
                        className="hidden"
                        disabled={submitting}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2 flex justify-end mt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-2" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Déposer le document
                  </>
                )}
              </Button>
            </div>
          </form>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 p-2 rounded">
              {error}
            </p>
          )}
        </div>

        {/* Existing documents list */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            Documents partagés
          </h4>

          {loading ? (
            <p className="text-xs text-neutral-500 italic flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Chargement des ressources...
            </p>
          ) : documents.length === 0 ? (
            <p className="text-xs text-neutral-500 italic">
              Aucune ressource assignée à cet élève pour le moment.
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => {
                const created =
                  typeof doc.createdAt === "string" ? new Date(doc.createdAt) : doc.createdAt;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div>
                      <h5 className="text-xs font-medium text-white flex items-center gap-2">
                        {doc.title}
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/20 uppercase tracking-wider font-bold">
                          {doc.documentType}
                        </span>
                        {doc.subject && (
                          <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full border border-cyan-500/20 uppercase tracking-wider font-bold">
                            {doc.subject}
                          </span>
                        )}
                      </h5>
                      <p className="text-[10px] text-neutral-500 mt-1">
                        Partagé le{" "}
                        {created.toLocaleDateString("fr-FR", {
                          dateStyle: "medium",
                        })}
                      </p>
                    </div>

                    <a
                      href={doc.localPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-accent hover:underline flex items-center gap-1 group transition-all"
                    >
                      <Globe className="w-3.5 h-3.5 group-hover:scale-105" />
                      Consulter
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
