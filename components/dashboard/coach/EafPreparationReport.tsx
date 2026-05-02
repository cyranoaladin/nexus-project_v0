"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Save, FileText } from "lucide-react";

interface EafReportData {
  linearReading?: string;
  workPresentation?: string;
  interview?: string;
  oralExpression?: string;
  writingMethod?: string;
  languageMastery?: string;
  literaryCulture?: string;
  strengths?: string;
  areasToImprove?: string;
  nextSessionGoals?: string;
  coachFreeComment?: string;
  status?: "DRAFT" | "VALIDATED";
  completionRatio?: number;
  updatedAt?: string;
  validatedAt?: string | null;
}

interface EafPreparationReportProps {
  studentId: string;
  studentName: string;
}

export function EafPreparationReport({ studentId, studentName }: EafPreparationReportProps) {
  const [report, setReport] = useState<EafReportData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setReport({});
    setLastSavedAt(null);
    setError(null);
    setMessage(null);
    setLoading(true);
    fetchReport();
  }, [studentId]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/coach/students/${studentId}/eaf-preparation-report`);
      if (res.ok) {
        const data = await res.json();
        if (data.report) {
          setReport(data.report);
          setLastSavedAt(data.report.updatedAt);
        }
      }
    } catch (err) {
      console.error("Failed to fetch EAF report:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Prevent saving if already validated
    if (report.status === "VALIDATED") {
      setError("Ce bilan est déjà validé et ne peut plus être modifié.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    // Build payload with ONLY editable pedagogical fields
    // Never send lifecycle fields (status, completionRatio, validatedAt, validatedBy, etc.)
    const editablePayload = {
      linearReading: report.linearReading,
      workPresentation: report.workPresentation,
      interview: report.interview,
      oralExpression: report.oralExpression,
      writingMethod: report.writingMethod,
      languageMastery: report.languageMastery,
      literaryCulture: report.literaryCulture,
      strengths: report.strengths,
      areasToImprove: report.areasToImprove,
      nextSessionGoals: report.nextSessionGoals,
      coachFreeComment: report.coachFreeComment,
    };

    try {
      const res = await fetch(`/api/coach/students/${studentId}/eaf-preparation-report`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editablePayload),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setReport(data.report);
      setLastSavedAt(data.report.updatedAt);
      setMessage("Brouillon sauvegardé.");
      return data.report as EafReportData;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      setError(message);
      throw new Error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof EafReportData, value: string) => {
    setReport((prev) => ({ ...prev, [field]: value }));
  };

  const requiredFields: (keyof EafReportData)[] = [
    "writingMethod",
    "languageMastery",
    "literaryCulture",
    "strengths",
    "areasToImprove",
    "nextSessionGoals",
    "coachFreeComment",
  ];

  const missingFields = requiredFields.filter((field) => !(report[field] || "").toString().trim());
  const completionRatio = Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100);
  const canValidate = missingFields.length === 0 && report.status !== "VALIDATED";

  const handleValidate = async () => {
    setValidating(true);
    setError(null);
    setMessage(null);

    try {
      await handleSave();

      const res = await fetch(`/api/coach/students/${studentId}/eaf-preparation-report/validate`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `HTTP ${res.status}`);
      }

      setReport(data.report);
      setLastSavedAt(data.report.updatedAt);
      setMessage(
        data.jobStatus?.created
          ? "Bilan validé. La demande de génération a été créée."
          : "Bilan validé. Le PDF sera généré lorsque les deux bilans seront prêts."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la validation");
    } finally {
      setValidating(false);
    }
  };

  const fields: { key: keyof EafReportData; label: string; placeholder: string }[] = [
    { key: "linearReading", label: "Lecture linéaire", placeholder: "Capacité à lire et comprendre un texte de manière fluide..." },
    { key: "workPresentation", label: "Présentation de l'œuvre", placeholder: "Capacité à présenter l'œuvre, le contexte, l'auteur..." },
    { key: "interview", label: "Entretien", placeholder: "Capacité à répondre aux questions de l'examinateur..." },
    { key: "oralExpression", label: "Expression orale", placeholder: "Qualité de l'expression, aisance, vocabulaire..." },
    { key: "writingMethod", label: "Méthode de commentaire / dissertation", placeholder: "Maîtrise de la méthode, construction du plan..." },
    { key: "languageMastery", label: "Maîtrise de la langue", placeholder: "Grammaire, orthographe, syntaxe, vocabulaire..." },
    { key: "literaryCulture", label: "Culture littéraire", placeholder: "Connaissance des œuvres, des mouvements littéraires..." },
    { key: "strengths", label: "Points forts", placeholder: "Ce que l'élève maîtrise bien..." },
    { key: "areasToImprove", label: "Points à travailler", placeholder: "Ce qui nécessite encore du travail..." },
    { key: "nextSessionGoals", label: "Objectifs pour la prochaine séance", placeholder: "Objectifs prioritaires pour la suite..." },
    { key: "coachFreeComment", label: "Commentaire libre du coach", placeholder: "Remarques libres, suggestions, observations..." },
  ];

  if (loading) {
    return (
      <Card className="bg-surface-card border-white/10 shadow-premium">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-card border-white/10 shadow-premium" data-testid="eaf-preparation-report">
      <CardHeader>
        <CardTitle className="text-white text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand-accent" />
          Bilan de préparation à l'EAF
        </CardTitle>
        <p className="text-xs text-neutral-400 mt-1">
          Suivi EAF de {studentName}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/20 text-rose-400 text-sm border border-rose-500/20">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-300 text-sm border border-emerald-500/20">
            {message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <div>
            <p className="text-xs font-medium text-neutral-200">
              Complétude requise: {completionRatio}%
            </p>
            <p className="text-[11px] text-neutral-500">
              Statut: {report.status === "VALIDATED" ? "validé" : "brouillon"}
            </p>
          </div>
          {report.status === "VALIDATED" && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Validé
            </span>
          )}
        </div>

        {report.status === "VALIDATED" && (
          <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-300 text-sm border border-emerald-500/20">
            Ce bilan est validé. Il est verrouillé pour garantir la cohérence du PDF généré.
          </div>
        )}

        {missingFields.length > 0 && report.status !== "VALIDATED" && (
          <p className="text-xs text-amber-300">
            Champs requis avant validation: {missingFields.length}.
          </p>
        )}

        {fields.map((field) => {
          const fieldId = `eaf-${studentId}-${field.key}`;
          return (
            <div key={field.key} className="space-y-2">
              <label htmlFor={fieldId} className="text-sm font-medium text-neutral-300">{field.label}</label>
              <textarea
                id={fieldId}
                value={report[field.key] || ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                maxLength={5000}
                disabled={report.status === "VALIDATED"}
                readOnly={report.status === "VALIDATED"}
                className={`w-full px-3 py-2 rounded-lg border text-neutral-100 placeholder:text-neutral-500 resize-y ${
                  report.status === "VALIDATED"
                    ? "bg-white/5 border-white/5 text-neutral-400 cursor-not-allowed"
                    : "bg-white/5 border-white/10 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent"
                }`}
              />
            </div>
          );
        })}

        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          {lastSavedAt && (
            <p className="text-xs text-neutral-500">
              Dernière mise à jour le {new Date(lastSavedAt).toLocaleString("fr-FR")}
            </p>
          )}
          {!lastSavedAt && (
            <p className="text-xs text-neutral-500">Aucune donnée sauvegardée</p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => void handleSave().catch(() => undefined)}
              disabled={saving || validating || report.status === "VALIDATED"}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
            <Button
              onClick={handleValidate}
              disabled={!canValidate || saving || validating}
              variant="outline"
              className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            >
              {validating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Valider
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
