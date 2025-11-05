import Link from "next/link";

interface DocHitProps {
  documentId: string;
  chunkId: string;
  title: string;
  snippet: string;
  modality: "text" | "image" | "table" | "formula";
  score: number;
}

export function DocHit({ documentId, chunkId, title, snippet, modality, score }: DocHitProps) {
  return (
    <Link
      href={`/rag/doc/${documentId}`}
      className="group block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      data-chunk-id={chunkId}
    >
      <article>
        <header className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-slate-950 group-focus-visible:text-slate-950">
            {title}
          </h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {modality} · {(score * 100).toFixed(0)}%
          </span>
        </header>
        <p className="line-clamp-3 text-sm text-slate-600">{snippet}</p>
      </article>
    </Link>
  );
}
