import Link from "next/link";

interface EpreuveItem {
  code: string;
  label: string;
  weight: number;
  scheduled_at?: string | null;
  format: string;
}

interface EpreuvesRoadmapProps {
  track: "Premiere" | "Terminale";
  profile: "Scolarise" | "CandidatLibre";
  items: EpreuveItem[];
}

export function EpreuvesRoadmap({ track, profile, items }: EpreuvesRoadmapProps) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Plan d&apos;épreuves</h2>
          <p className="text-sm text-slate-500">
            Parcours {track === "Premiere" ? "Première" : "Terminale"} · {profile}
          </p>
        </div>
        <Link
          className="text-xs font-semibold text-indigo-700 underline-offset-2 hover:underline"
          href="/dashboard/epreuves"
        >
          Voir le détail
        </Link>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.code} className="rounded-md bg-slate-50 px-3 py-2">
            <p className="font-medium text-slate-800">{item.label}</p>
            <p className="text-xs text-slate-500">
              Coefficient {item.weight.toFixed(1)} · {item.format}
              {item.scheduled_at ? ` · ${new Date(item.scheduled_at).toLocaleDateString("fr-FR")}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
