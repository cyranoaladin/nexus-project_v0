import Link from "next/link";

type AgendaCardItem = {
  id: string;
  at?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  kind: string;
  title: string;
  location?: string | null;
  status?: string | null;
};

interface AgendaCardProps {
  items: AgendaCardItem[];
}

export function AgendaCard({ items }: AgendaCardProps) {
  const statusBadge = (status?: string | null) => {
    if (!status) return { text: null, className: "" };
    const normalized = status.toLowerCase();
    if (normalized.includes("confirm")) {
      return { text: status, className: "bg-emerald-200 text-emerald-700" };
    }
    if (normalized.includes("propos")) {
      return { text: status, className: "bg-amber-200 text-amber-700" };
    }
    if (normalized.includes("annul")) {
      return { text: status, className: "bg-rose-200 text-rose-700" };
    }
    return { text: status, className: "bg-slate-200 text-slate-600" };
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Agenda</h2>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            {items.length} événement{items.length > 1 ? "s" : ""} planifié{items.length > 1 ? "s" : ""}
          </p>
        </div>
        <Link
          className="text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
          href="/dashboard/agenda"
        >
          Voir l&apos;agenda
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
          Aucun événement à venir. Réservez une session ou contactez votre coach pour en planifier une.
        </p>
      ) : (
        <ul className="space-y-3 text-sm">
          {items.map((item) => {
            const timestamp = item.at ?? item.start_at;
            const badge = statusBadge(item.status);
            return (
              <li key={item.id} className="flex justify-between rounded-md bg-slate-50 px-3 py-2">
                <div>
                  <p className="font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    {timestamp
                      ? new Date(timestamp).toLocaleString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Horodatage à venir"}
                    {item.location ? ` · ${item.location}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {item.kind}
                  </span>
                  {badge.text ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                    >
                      {badge.text}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
