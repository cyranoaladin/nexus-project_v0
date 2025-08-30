'use client';

// app/dashboard/admin/debug/pdf/page.tsx
import { useState } from 'react';

// En mode E2E/test, on préfèrera le fallback local pour ne pas dépendre du microservice.
// process.env.NEXT_PUBLIC_... est accessible côté client.
const useRemotePdfService = process.env.NEXT_PUBLIC_PDF_REMOTE_DISABLED !== '1';

export default function AdminDebugPdfPage() {
  const [content, setContent] = useState<string>(
    'Points clés:\n- Définition\n- Dérivées\n- Racines et tableau de signes'
  );
  const [subject, setSubject] = useState<string>('Mathematiques');
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onGenerate = async () => {
    setGenerating(true);
    setError(null);
    setUrl(null);
    try {
      // On choisit l'endpoint en fonction de la configuration d'environnement
      const endpoint = useRemotePdfService ? '/api/debug/pdf/remote' : '/api/debug/pdf';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, matiere: subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur de génération');
      setUrl(data?.url as string);
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">
        Debug PDF ({useRemotePdfService ? 'Service distant' : 'Fallback local'})
      </h1>
      <p className="text-sm text-gray-600">
        Cette page permet de tester la génération de PDF via le{' '}
        <strong>{useRemotePdfService ? 'microservice PDF' : 'fallback local (pdfkit)'}</strong>.
      </p>

      <label className="block text-sm font-medium">Matière</label>
      <input
        className="w-full border rounded p-2"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Mathematiques"
      />

      <label className="block text-sm font-medium mt-3">Contenu</label>
      <textarea
        className="w-full border rounded p-2 h-40"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <button
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={onGenerate}
        disabled={generating}
        data-testid="debug-generate-pdf"
      >
        {generating ? 'Génération…' : 'Générer le PDF'}
      </button>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {url && (
        <p className="text-green-700 text-sm mt-2">
          PDF prêt:{' '}
          <a className="underline" href={url} target="_blank">
            Télécharger
          </a>
        </p>
      )}
    </div>
  );
}
