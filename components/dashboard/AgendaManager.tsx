"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { AgendaCard } from "@/components/dashboard/AgendaCard";
import { NexusApiClient, type AgendaItem } from "@/ts_client";

const ROLE_TO_API: Record<string, string> = {
  ELEVE: "student",
  PARENT: "parent",
  COACH: "coach",
  ADMIN: "admin",
  ASSISTANTE: "assistante",
};

function mapRole(role?: string | null): string {
  if (!role) return "student";
  return ROLE_TO_API[role.toUpperCase()] ?? "student";
}

interface AgendaManagerProps {
  initialAgenda: AgendaItem[];
  initialError?: string | null;
  studentId?: string | null;
}

type Notice = { type: "success" | "error" | "info"; message: string };

export function AgendaManager({ initialAgenda, initialError = null, studentId }: AgendaManagerProps) {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<AgendaItem[]>(initialAgenda);
  const [notice, setNotice] = useState<Notice | null>(
    initialError ? { type: "error", message: initialError } : null,
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingKind, setBookingKind] = useState("Visio");
  const [bookingDate, setBookingDate] = useState<string>("");
  const [bookingTime, setBookingTime] = useState<string>("");
  const [bookingDuration, setBookingDuration] = useState<number>(60);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  const effectiveStudentId = useMemo(() => {
    if (studentId) return studentId;
    if (session?.user?.role === "ELEVE") return session.user.id;
    return studentId ?? "";
  }, [session?.user?.id, session?.user?.role, studentId]);

  const apiClient = useMemo(() => new NexusApiClient({ baseUrl: "/pyapi" }), []);

  const headers = useMemo(() => {
    const role = mapRole(session?.user?.role);
    const data: Record<string, string> = {
      "X-Role": role,
    };
    if (session?.user?.id) {
      data["X-Actor-Id"] = session.user.id;
    }
    if (effectiveStudentId) {
      data["X-Student-Id"] = effectiveStudentId;
    }
    return data;
  }, [effectiveStudentId, session?.user?.id, session?.user?.role]);

  const canCancel = useMemo(() => {
    const role = session?.user?.role;
    return role === "COACH" || role === "ADMIN";
  }, [session?.user?.role]);

  const canBook = useMemo(() => session?.user?.role === "ELEVE", [session?.user?.role]);

  const refreshAgenda = useCallback(async () => {
    if (!effectiveStudentId) return;
    setIsRefreshing(true);
    try {
      const fromIso = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined;
      const toIso = toDate ? new Date(`${toDate}T23:59:59`).toISOString() : undefined;
      const data = await apiClient.dashboard.agenda(
        effectiveStudentId,
        fromIso,
        toIso,
        { headers },
      );
      setItems(data.items ?? []);
      setNotice(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible de rafraîchir l'agenda";
      setNotice({ type: "error", message });
    } finally {
      setIsRefreshing(false);
    }
  }, [apiClient, effectiveStudentId, headers, fromDate, toDate]);

  useEffect(() => {
    if (initialError || !effectiveStudentId) return;
    if (status === "authenticated" && initialAgenda.length === 0) {
      void refreshAgenda();
    }
  }, [effectiveStudentId, initialAgenda.length, initialError, refreshAgenda, status]);

  const handleBook = async (event: FormEvent) => {
    event.preventDefault();
    if (!canBook) {
      setNotice({ type: "error", message: "Seuls les élèves peuvent réserver une session" });
      return;
    }
    if (!effectiveStudentId) {
      setNotice({ type: "error", message: "Identifiant élève manquant pour la réservation" });
      return;
    }
    if (!bookingDate || !bookingTime) {
      setNotice({ type: "error", message: "Renseignez une date et une heure" });
      return;
    }
    const slotStart = new Date(`${bookingDate}T${bookingTime}:00`);
    if (Number.isNaN(slotStart.getTime())) {
      setNotice({ type: "error", message: "Horodatage invalide" });
      return;
    }
    const slotEnd = new Date(slotStart.getTime() + bookingDuration * 60 * 1000);
    setIsBooking(true);
    setNotice(null);
    try {
      await apiClient.sessions.book(
        {
          student_id: effectiveStudentId,
          kind: bookingKind,
          slot_start: slotStart.toISOString(),
          slot_end: slotEnd.toISOString(),
          capacity: 1,
          price_cents: 0,
        },
        { headers },
      );
      setNotice({ type: "success", message: "Session réservée avec succès" });
      setBookingDate("");
      setBookingTime("");
      await refreshAgenda();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Échec de la réservation";
      setNotice({ type: "error", message });
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancel = async (sessionId: string) => {
    if (!canCancel) return;
    setCancellingId(sessionId);
    setNotice(null);
    try {
      await apiClient.sessions.cancel(sessionId, { headers });
      setNotice({ type: "success", message: "Session annulée." });
      await refreshAgenda();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Impossible d'annuler la session";
      setNotice({ type: "error", message });
    } finally {
      setCancellingId(null);
    }
  };

  const formatICSDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  };

  const escapeICSText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

  const handleExportICS = () => {
    if (items.length === 0) {
      setNotice({ type: "info", message: "Aucune session à exporter pour cette période." });
      return;
    }
    setIsExporting(true);
    try {
      const now = new Date();
      const dtStamp = now.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Nexus Reussite//Dashboard Agenda//FR",
      ];
      for (const item of items) {
        const start = formatICSDate(item.start_at);
        const end = formatICSDate(item.end_at ?? item.start_at);
        if (!start || !end) continue;
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${item.id}@nexus-reussite`);
        lines.push(`DTSTAMP:${dtStamp}`);
        lines.push(`DTSTART:${start}`);
        lines.push(`DTEND:${end}`);
        lines.push(`SUMMARY:${escapeICSText(item.title)}`);
        lines.push(`DESCRIPTION:${escapeICSText(`Type: ${item.kind} | Statut: ${item.status}`)}`);
        if (item.location) {
          lines.push(`LOCATION:${escapeICSText(item.location)}`);
        }
        lines.push("END:VEVENT");
      }
      lines.push("END:VCALENDAR");
      const blob = new Blob([lines.join("\n")], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "agenda-nexus.ics";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setNotice({ type: "success", message: "Export ICS généré." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export ICS impossible";
      setNotice({ type: "error", message });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Sessions programmées</h3>
          <p className="text-sm text-slate-500">
            Données synchronisées avec l&apos;API `/dashboard/agenda`. Filtrez par période pour focaliser la vue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshAgenda()}
            disabled={isRefreshing || !effectiveStudentId}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing ? "Actualisation…" : "Rafraîchir"}
          </button>
          <button
            type="button"
            onClick={handleExportICS}
            disabled={isExporting || items.length === 0}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            title={items.length === 0 ? "Aucune session à exporter" : "Exporter au format ICS"}
          >
            {isExporting ? "Export…" : "Export ICS"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <div className="md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="agenda-from">
            Début
          </label>
          <input
            id="agenda-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="agenda-to">
            Fin
          </label>
          <input
            id="agenda-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
          />
        </div>
        <div className="md:col-span-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setFromDate("");
              setToDate("");
              void refreshAgenda();
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-slate-400"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={() => void refreshAgenda()}
            disabled={isRefreshing || !effectiveStudentId}
            className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Appliquer les filtres
          </button>
        </div>
      </div>

      <AgendaCard items={items} />

      <section className="grid gap-6 lg:grid-cols-2">
        <form className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm" onSubmit={handleBook}>
          <h3 className="text-base font-semibold text-slate-900">Réserver une session</h3>
          {!canBook ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              La réservation directe est réservée aux élèves. Vous pouvez créer une session depuis l&apos;espace coach.
            </p>
          ) : null}
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="session-kind">
              Modalité
            </label>
            <select
              id="session-kind"
              value={bookingKind}
              onChange={(event) => setBookingKind(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="Visio">Visio</option>
              <option value="Présentiel">Présentiel</option>
              <option value="Stage">Stage</option>
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="session-date">
                Date
              </label>
              <input
                id="session-date"
                type="date"
                value={bookingDate}
                onChange={(event) => setBookingDate(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700" htmlFor="session-time">
                Heure
              </label>
              <input
                id="session-time"
                type="time"
                value={bookingTime}
                onChange={(event) => setBookingTime(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700" htmlFor="session-duration">
              Durée (minutes)
            </label>
            <input
              id="session-duration"
              type="number"
              min={30}
              max={240}
              step={15}
              value={bookingDuration}
              onChange={(event) => {
                const value = Number(event.target.value);
                setBookingDuration(Number.isNaN(value) ? 60 : value);
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-900 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={
              isBooking || !effectiveStudentId || status !== "authenticated" || !canBook
            }
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isBooking ? "Réservation…" : "Réserver"}
          </button>
          {!effectiveStudentId ? (
            <p className="text-xs text-slate-500">
              Renseignez un identifiant élève via le paramètre `student_id` pour activer la réservation.
            </p>
          ) : null}
        </form>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">Gestion</h3>
          {canCancel ? (
            <p className="text-sm text-slate-500">
              Sélectionnez une session pour l&apos;annuler. L&apos;action est réservée au staff pédagogique.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Vous pouvez contacter votre coach pour modifier ou annuler une session planifiée.
            </p>
          )}
          {canCancel ? (
            <ul className="space-y-2 text-sm">
              {items.map((item) => (
                <li key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2">
                  <span className="text-slate-700">{item.title}</span>
                  <button
                    type="button"
                    onClick={() => void handleCancel(item.id)}
                    disabled={cancellingId === item.id}
                    className="rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
                  >
                    {cancellingId === item.id ? "Annulation…" : "Annuler"}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
