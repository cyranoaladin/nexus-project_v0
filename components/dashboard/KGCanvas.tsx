import Link from "next/link";

interface KGCanvasProps {
  nodes: Array<{ id: string; label: string; mastery: number }>;
}

// Placeholder that will later host an interactive knowledge graph.
export function KGCanvas({ nodes }: KGCanvasProps) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Graphe de connaissances
          </h2>
          <p className="text-sm text-slate-500">
            Visualisation simplifiée en attendant l&apos;intégration 3D complète.
          </p>
        </div>
        <Link
          className="text-xs font-semibold text-slate-700 underline-offset-2 hover:underline"
          href="/dashboard/cours"
        >
          Explorer les cours
        </Link>
      </div>
      <ul className="grid gap-2 text-sm">
        {nodes.map((node) => (
          <li
            key={node.id}
            className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
          >
            <span className="font-medium text-slate-700">{node.label}</span>
            <span className="text-slate-500">{Math.round(node.mastery * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
