import Link from 'next/link';

export function BilanCard({ id, scorePct, createdAt, pdfUrl }: { id: string; scorePct?: number; createdAt?: string; pdfUrl?: string | null; }) {
  return (
    <div className="border rounded-lg p-4 flex items-center justify-between">
      <div>
        <div className="text-sm text-gray-500">Bilan</div>
        <div className="font-semibold">Score: {scorePct != null ? `${Math.round(scorePct)}%` : '—'}</div>
        <div className="text-xs text-gray-400">{createdAt ? new Date(createdAt).toLocaleString() : ''}</div>
      </div>
      <div className="flex gap-2">
        {pdfUrl ? (
          <Link className="px-3 py-2 bg-blue-600 text-white rounded" href={pdfUrl} prefetch={false} target="_blank">Télécharger</Link>
        ) : (
          <Link className="px-3 py-2 bg-gray-200 rounded" href={`/api/bilans/${id}/download`}>Télécharger</Link>
        )}
        <Link className="px-3 py-2 border rounded" href={`/api/bilans/${id}/status`}>Statut</Link>
      </div>
    </div>
  );
}
