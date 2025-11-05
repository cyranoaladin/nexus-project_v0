"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  EvaluationFeedbackItem,
  EvaluationResponse,
  EvalGenerateRequest,
  NexusApiClient,
  NexusApiError,
} from "@/ts_client";
import { UploadCopy } from "@/components/eval/UploadCopy";
import { EvaluationDetails } from "@/components/eval/EvaluationDetails";

const ROLE_TO_API: Record<string, string> = {
  ELEVE: "student",
  PARENT: "parent",
  COACH: "coach",
  ADMIN: "admin",
  ASSISTANTE: "assistante",
};

const MAX_COPY_SIZE_BYTES = 10 * 1024 * 1024;
const CONSTRAINTS_PLACEHOLDER = `chapitre:Limites, format=QCM, difficulte=avance ou JSON {"chapitre":"Limites"}`;

function mapRole(role?: string | null): string {
  if (!role) return "student";
  return ROLE_TO_API[role.toUpperCase()] ?? "student";
}

interface NoticeState {
  type: "success" | "error" | "info";
  message: string;
}

interface EvaluationsManagerProps {
  initialEvaluations?: EvaluationResponse[];
  initialStudentId?: string;
  initialError?: string;
}

export function EvaluationsManager({
  initialEvaluations = [],
  initialStudentId,
  initialError,
}: EvaluationsManagerProps) {
  const { data: session, status } = useSession();
  const [studentId, setStudentId] = useState<string>(initialStudentId ?? "");
  const [evaluations, setEvaluations] = useState<EvaluationResponse[]>(initialEvaluations);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmittingCopy, setIsSubmittingCopy] = useState(false);
  const [isApplyingGrade, setIsApplyingGrade] = useState(false);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(
    initialEvaluations.length ? initialEvaluations[0].id : null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("Mathématiques");
  const [level, setLevel] = useState("Terminale");
  const [duration, setDuration] = useState(45);
  const [constraintsText, setConstraintsText] = useState("");
  const [score, setScore] = useState<string>("");
  const [coachFeedback, setCoachFeedback] = useState<string>("");
  const [notice, setNotice] = useState<NoticeState | null>(
    initialError ? { type: "error", message: initialError } : null,
  );
  const [statusFilter, setStatusFilter] = useState<"Tous" | "Proposé" | "Soumis" | "Corrigé">("Tous");
  const initialLoadDone = useRef(false);

  const resolveErrorMessage = useCallback((error: unknown, fallback: string) => {
    if (error instanceof NexusApiError) {
      return error.message || fallback;
    }
    if (error instanceof Error) {
      return error.message || fallback;
    }
    return fallback;
  }, []);

  const apiRole = useMemo(() => mapRole(session?.user?.role), [session?.user?.role]);
  const actorId = session?.user?.id ?? null;

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "ELEVE") {
      setStudentId((prev) => prev || session.user.id);
    }
  }, [session?.user?.id, session?.user?.role, status]);

  useEffect(() => {
    if (initialStudentId && !studentId) {
      setStudentId(initialStudentId);
    }
  }, [initialStudentId, studentId]);

  const apiClient = useMemo(() => new NexusApiClient({ baseUrl: "/pyapi" }), []);

  const buildHeaders = useCallback(
    (targetStudentId?: string) => {
      const headers: Record<string, string> = {
        "X-Role": apiRole,
      };
      if (actorId) {
        headers["X-Actor-Id"] = actorId;
      }
      if (targetStudentId) {
        headers["X-Student-Id"] = targetStudentId;
      }
      return headers;
    },
    [actorId, apiRole],
  );

  const loadEvaluations = useCallback(async () => {
    if (!studentId) return;
    setIsLoadingList(true);
    setNotice(null);
    try {
      const list = await apiClient.eval.list(studentId, {
        headers: buildHeaders(studentId),
      });
      setEvaluations(list);
      if (list.length) {
        setSelectedEvaluationId((current) => current ?? list[0].id);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: resolveErrorMessage(error, "Impossible de charger les évaluations"),
      });
    } finally {
      setIsLoadingList(false);
    }
  }, [apiClient, buildHeaders, resolveErrorMessage, studentId]);

  useEffect(() => {
    if (!studentId) return;
    const shouldSkipInitialFetch =
      !initialLoadDone.current &&
      initialStudentId &&
      studentId === initialStudentId &&
      initialEvaluations.length > 0 &&
      !initialError;
    if (shouldSkipInitialFetch) {
      initialLoadDone.current = true;
      return;
    }
    initialLoadDone.current = true;
    void loadEvaluations();
  }, [initialError, initialEvaluations.length, initialStudentId, loadEvaluations, studentId]);

  useEffect(() => {
    if (evaluations.length === 0) {
      setSelectedEvaluationId(null);
      return;
    }
    const exists = evaluations.some((item) => item.id === selectedEvaluationId);
    if (!exists) {
      setSelectedEvaluationId(evaluations[0].id);
    }
  }, [evaluations, selectedEvaluationId]);

  useEffect(() => {
    setSelectedFile(null);
  }, [selectedEvaluationId]);

  const filteredEvaluations = useMemo(() => {
    if (statusFilter === "Tous") {
      return evaluations;
    }
    return evaluations.filter((item) => item.status === statusFilter);
  }, [evaluations, statusFilter]);

  useEffect(() => {
    if (filteredEvaluations.length === 0) {
      setSelectedEvaluationId(null);
      return;
    }
    const exists = filteredEvaluations.some((item) => item.id === selectedEvaluationId);
    if (!exists) {
      setSelectedEvaluationId(filteredEvaluations[0].id);
    }
  }, [filteredEvaluations, selectedEvaluationId]);

  const selectedEvaluation = useMemo(() => {
    if (!selectedEvaluationId) return null;
    return evaluations.find((item) => item.id === selectedEvaluationId) ?? null;
  }, [evaluations, selectedEvaluationId]);

  const statusCounts = useMemo(() => {
    return evaluations.reduce(
      (acc, item) => {
        if (item.status === "Proposé" || item.status === "Soumis" || item.status === "Corrigé") {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
        }
        return acc;
      },
      { Proposé: 0, Soumis: 0, Corrigé: 0 } as Record<"Proposé" | "Soumis" | "Corrigé", number>,
    );
  }, [evaluations]);

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    if (!studentId) {
      setNotice({ type: "error", message: "Veuillez renseigner l'identifiant élève" });
      return;
    }
    let constraints: Record<string, string> | undefined;
    const trimmedConstraints = constraintsText.trim();
    if (trimmedConstraints.length > 0) {
      try {
        if (trimmedConstraints.startsWith("{")) {
          const parsed = JSON.parse(trimmedConstraints) as Record<string, string | number>;
          constraints = Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          }, {});
        } else {
          const entries = trimmedConstraints
            .split(/\n|,/)
            .map((item) => item.trim())
            .filter(Boolean);
          if (entries.length === 0) {
            constraints = undefined;
          } else {
            constraints = entries.reduce<Record<string, string>>((acc, line) => {
              const separator = line.includes(":") ? ":" : line.includes("=") ? "=" : null;
              if (!separator) {
                throw new Error("Utilisez le format clé:valeur ou JSON");
              }
              const [rawKey, ...rest] = line.split(separator);
              const key = rawKey?.trim();
              const value = rest.join(separator).trim();
              if (!key || !value) {
                throw new Error("Chaque contrainte doit inclure une clé et une valeur");
              }
              acc[key] = value;
              return acc;
            }, {});
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Impossible de parser les contraintes fournies";
        setNotice({ type: "error", message });
        return;
      }
    }
    const normalizedConstraints =
      constraints && Object.keys(constraints).length > 0 ? constraints : undefined;
    const payload: EvalGenerateRequest = {
      student_id: studentId,
      subject,
      level,
      duration,
      constraints: normalizedConstraints,
    };
    setIsGenerating(true);
    setNotice(null);
    try {
      const created = await apiClient.eval.generate(payload, {
        headers: buildHeaders(studentId),
      });
      setEvaluations((prev) => [created, ...prev]);
      setSelectedEvaluationId(created.id);
      setStatusFilter("Tous");
      setConstraintsText("");
      setNotice({ type: "success", message: "Sujet généré avec succès" });
    } catch (error) {
      setNotice({
        type: "error",
        message: resolveErrorMessage(error, "Impossible de générer le sujet"),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendCopy = async () => {
    if (!selectedEvaluationId) {
      setNotice({ type: "error", message: "Sélectionnez l'évaluation cible" });
      return;
    }
    if (!selectedFile) {
      setNotice({ type: "error", message: "Ajoutez un fichier avant l'envoi" });
      return;
    }
    if (selectedFile.size > MAX_COPY_SIZE_BYTES) {
      setNotice({ type: "error", message: "La copie dépasse 10 Mo, compressez le fichier avant dépôt." });
      return;
    }
    setIsSubmittingCopy(true);
    setNotice(null);
    try {
      const updated = await apiClient.eval.grade(
        selectedEvaluationId,
        [selectedFile],
        {
          headers: buildHeaders(studentId || undefined),
        },
      );
      setEvaluations((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice({ type: "success", message: "Copie déposée. Statut mis à jour." });
      setSelectedFile(null);
    } catch (error) {
      setNotice({
        type: "error",
        message: resolveErrorMessage(error, "Impossible de déposer la copie"),
      });
    } finally {
      setIsSubmittingCopy(false);
    }
  };

  const handleApplyGrade = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedEvaluationId) {
      setNotice({ type: "error", message: "Sélectionnez l'évaluation à corriger" });
      return;
    }
    if (score.trim() === "") {
      setNotice({ type: "error", message: "Renseignez une note sur 20" });
      return;
    }
    const numericScore = Number(score.replace(",", ".").trim());
    if (Number.isNaN(numericScore)) {
      setNotice({ type: "error", message: "La note doit être un nombre" });
      return;
    }
    if (numericScore < 0 || numericScore > 20) {
      setNotice({ type: "error", message: "La note doit être comprise entre 0 et 20" });
      return;
    }
    setIsApplyingGrade(true);
    setNotice(null);
    try {
      const feedbackItems: EvaluationFeedbackItem[] = coachFeedback
        ? [{ step: "Synthèse", comment: coachFeedback }]
        : [];
      const updated = await apiClient.eval.grade(
        selectedEvaluationId,
        [],
        {
          score_20: numericScore,
          feedback: feedbackItems,
          headers: buildHeaders(studentId || undefined),
        },
      );
      setEvaluations((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice({ type: "success", message: "Correction enregistrée." });
      setScore("");
      setCoachFeedback("");
    } catch (error) {
      setNotice({
        type: "error",
        message: resolveErrorMessage(error, "Impossible d'enregistrer la correction"),
      });
    } finally {
      setIsApplyingGrade(false);
    }
  };

  const isCoach = apiRole === "coach" || apiRole === "admin";

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleGenerate}>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="student-id">
              Identifiant élève (schema nexus_app)
            </label>
            <input
              id="student-id"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value.trim())}
              placeholder="UUID de l'élève"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="subject">
              Matière
            </label>
            <input
              id="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="level">
              Niveau
            </label>
            <input
              id="level"
              value={level}
              onChange={(event) => setLevel(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="duration">
              Durée (minutes)
            </label>
            <input
              id="duration"
              type="number"
              min={10}
              max={240}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="constraints">
              Contraintes (optionnel)
            </label>
            <textarea
              id="constraints"
              rows={2}
              value={constraintsText}
              onChange={(event) => setConstraintsText(event.target.value)}
              placeholder={CONSTRAINTS_PLACEHOLDER}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Format accepté : une contrainte par ligne avec <code>clé:valeur</code> ou <code>clé=valeur</code>, ou bien un JSON complet.
            </p>
          </div>
          <div className="flex items-end justify-end">
            <button
              type="submit"
              disabled={isGenerating || !isCoach}
              className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isGenerating ? "Génération…" : "Générer un sujet"}
            </button>
          </div>
        </form>
        {!isCoach ? (
          <p className="mt-3 text-xs text-slate-500">
            Seuls les coachs ou administrateurs peuvent générer de nouveaux sujets.
          </p>
        ) : null}
      </section>

      {notice ? (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            notice.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : notice.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {notice.message}
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Évaluations disponibles</h3>
              <p className="text-sm text-slate-500">
                Statuts et dépôts sont synchronisés via l&apos;API FastAPI /dashboard/evaluations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(["Tous", "Proposé", "Soumis", "Corrigé"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    statusFilter === status
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {status === "Tous" ? "Tous" : status}
                  {status !== "Tous" ? ` (${statusCounts[status] ?? 0})` : ""}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void loadEvaluations()}
                disabled={isLoadingList || !studentId}
                className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingList ? "Actualisation..." : "Rafraîchir"}
              </button>
            </div>
          </div>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500">Proposées</p>
              <p className="text-lg font-semibold text-slate-900">{statusCounts["Proposé"]}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500">Soumises</p>
              <p className="text-lg font-semibold text-slate-900">{statusCounts["Soumis"]}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500">Corrigées</p>
              <p className="text-lg font-semibold text-slate-900">{statusCounts["Corrigé"]}</p>
            </div>
          </div>
          {filteredEvaluations.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune évaluation ne correspond à ce filtre. Générer un nouveau sujet ou élargissez votre sélection.
            </p>
          ) : (
            <ul className="grid gap-4">
              {filteredEvaluations.map((item) => {
                const isSelected = selectedEvaluationId === item.id;
                return (
                  <li
                    key={item.id}
                    className={`rounded-lg border p-4 transition ${
                      isSelected ? "border-slate-900 bg-slate-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">
                          {item.subject} · {item.duration_min} min
                        </h4>
                        <p className="text-xs text-slate-500">
                          Statut : <span className="font-medium">{item.status}</span>
                        </p>
                        {item.metadata.level ? (
                          <p className="text-xs text-slate-500">Niveau : {item.metadata.level}</p>
                        ) : null}
                        {item.score_20 !== undefined && item.score_20 !== null ? (
                          <p className="text-xs text-emerald-600">Dernière note : {item.score_20}/20</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedEvaluationId(item.id)}
                        className={`rounded-md px-3 py-1 text-xs font-semibold ${
                          isSelected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {isSelected ? "Sélectionnée" : "Sélectionner"}
                      </button>
                    </div>
                    {item.submissions && item.submissions.length ? (
                      <div className="mt-3 rounded-md bg-slate-100 p-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-700">Dernier dépôt</p>
                        <p>
                          {new Date(item.submissions[0].submitted_at).toLocaleString()} · {item.submissions[0].files.length} fichier(s)
                        </p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <EvaluationDetails evaluation={selectedEvaluation} className="self-start" />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Déposer une copie</h3>
          <UploadCopy onUpload={setSelectedFile} value={selectedFile} />
          <button
            type="button"
            onClick={() => void handleSendCopy()}
            disabled={isSubmittingCopy || !selectedEvaluationId}
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmittingCopy ? "Téléversement…" : "Envoyer la copie"}
          </button>
          <p className="text-xs text-slate-500">
            La requête cible l&apos;endpoint FastAPI <code>/eval/grade</code> avec rôle {apiRole}.
          </p>
        </div>

        {isCoach ? (
          <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleApplyGrade}>
            <h3 className="text-base font-semibold text-slate-900">Attribuer une note</h3>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="score">
                Note /20
              </label>
              <input
                id="score"
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={score}
                onChange={(event) => setScore(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="coach-feedback">
                Commentaire synthèse
              </label>
              <textarea
                id="coach-feedback"
                rows={3}
                value={coachFeedback}
                onChange={(event) => setCoachFeedback(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isApplyingGrade || !selectedEvaluationId}
              className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {isApplyingGrade ? "Enregistrement…" : "Enregistrer la correction"}
            </button>
            <p className="text-xs text-slate-500">
              Cette action envoie une requête <code>/eval/grade</code> avec note et feedback JSON.
            </p>
          </form>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-100 p-6 text-sm text-slate-500">
            Les corrections sont réservées au staff pédagogique.
          </div>
        )}
      </section>
    </div>
  );
}
