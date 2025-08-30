'use client';

// app/dashboard/admin/debug/pdf-aria/page.tsx
import { useEffect, useMemo, useState } from 'react';

export const dynamic = 'force-dynamic';

function extractLatex(text: string): string | null {
  if (!text) return null;
  const fence = text.match(/```\s*latex\s*([\s\s\S]+?)```/i);
  if (fence && fence[1]) return fence[1].trim();
  const doc = text.match(/(\\\s*documentclass[\s\S]+?\\end\{document\})/);
  if (doc && doc[1]) return doc[1].trim();
  return null;
}

function stripLatexToPlain(lx: string): string {
  return (lx || '')
    .replace(/%.*$/gm, '') // comments
    .replace(/\\begin\{[^}]+\}|\\end\{[^}]+\}/g, ' ')
    .replace(/\\[^\s{]+\{[^}]*\}/g, ' ') // commands with one arg
    .replace(/\\[^\s]+/g, ' ') // other commands
    .replace(/\$[^$]*\$/g, ' ') // inline math
    .replace(/\{\}|[{}]/g, ' ') // braces
    .replace(/\s+/g, ' ')
    .trim();
}

function computeMetrics(latex: string | null, resp: string | null) {
  const textBase = latex ? stripLatexToPlain(latex) : resp || '';
  const words = textBase.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sectionCount = latex ? (latex.match(/\\section\{/g) || []).length : 0;
  const subCount = latex ? (latex.match(/\\subsection\{/g) || []).length : 0;
  const subsubCount = latex ? (latex.match(/\\subsubsection\{/g) || []).length : 0;
  // Heuristique exercices corrigés: Exercice + Correction proche
  let correctedExCount = 0;
  if (latex) {
    const exRe = /Exercice[^\n]*|\\subsection\*?\{Exercice[^}]*\}/gi;
    const corrRe = /Correction/gi;
    const matches = latex.matchAll(exRe);
    for (const m of matches) {
      const start = m.index || 0;
      const window = latex.slice(start, start + 1200);
      if (corrRe.test(window)) correctedExCount++;
    }
  }
  // Heuristique non corrigés: présence section + nombre \item suivant
  let uncorrectedExCount = 0;
  let hasUncorrSection = false;
  if (latex) {
    const secIdx = latex.search(/Exercices?\s+non\s+corrig/iu);
    if (secIdx >= 0) {
      hasUncorrSection = true;
      const tail = latex.slice(secIdx);
      const items = tail.match(/\\item\b/g) || [];
      uncorrectedExCount = items.length || 0;
    }
  }
  return {
    wordCount,
    sectionCount,
    subCount,
    subsubCount,
    correctedExCount,
    uncorrectedExCount,
    hasUncorrSection,
  };
}

export default function AdminDebugPdfAriaPage() {
  const [subject, setSubject] = useState('MATHEMATIQUES');
  const [message, setMessage] = useState(
    'Génère un PDF complet de révision en Mathématiques sur les fonctions polynômes (niveau Terminale), structuré en sections numérotées, avec démonstrations, 3 exercices corrigés et 3 non corrigés, objectifs pédagogiques et pièges fréquents.'
  );
  const [generating, setGenerating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [resp, setResp] = useState<string | null>(null);
  const [latex, setLatex] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compiledUrl, setCompiledUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [fakeLocal, setFakeLocal] = useState(false);

  const metrics = useMemo(() => computeMetrics(latex, resp), [latex, resp]);

  const onGenerateViaAria = async () => {
    setGenerating(true);
    setError(null);
    setUrl(null);
    setCompiledUrl(null);
    setResp(null);
    setLatex(null);
    setFakeLocal(false);
    try {
      const res = await fetch('/api/aria/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur de génération via ARIA');
      setUrl(data?.documentUrl || null);
      setResp(data?.response || null);
      setFakeLocal(!!data?.fakeLocal);
      const lx = extractLatex(String(data?.response || ''));
      if (lx) setLatex(lx);
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue');
    } finally {
      setGenerating(false);
    }
  };

  const onCompileMicroservice = async () => {
    if (!latex) {
      setError('Aucun LaTeX extrait à compiler.');
      return;
    }
    setCompiling(true);
    setError(null);
    setCompiledUrl(null);
    try {
      const res = await fetch('/api/debug/pdf/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contenu: latex, matiere: subject, nom_eleve: 'Debug ARIA' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Erreur compilation microservice');
      setCompiledUrl(String(data?.url || ''));
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue');
    } finally {
      setCompiling(false);
    }
  };

  const okWord = metrics.wordCount >= 1200;
  const okCorr = metrics.correctedExCount >= 3;
  const okUncorr = metrics.hasUncorrSection && metrics.uncorrectedExCount >= 3;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Debug PDF (ARIA / LLM)</h1>
        {fakeLocal && (
          <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-800 border border-yellow-300">
            Fake local
          </span>
        )}
      </div>
      <p className="text-sm text-gray-600">
        Cette page déclenche la génération PDF via ARIA (appel LLM + compilation), puis affiche la
        réponse brute et le LaTeX extrait. Vous pouvez recompiler le LaTeX directement via le
        microservice pour une boucle de test rapide.
      </p>

      <div className="grid gap-3">
        <label className="text-sm font-medium">Matière (enum Prisma)</label>
        <select
          className="border rounded p-2"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="MATHEMATIQUES">MATHEMATIQUES</option>
          <option value="PHYSIQUE_CHIMIE">PHYSIQUE_CHIMIE</option>
          <option value="FRANCAIS">FRANCAIS</option>
          <option value="ANGLAIS">ANGLAIS</option>
          <option value="HISTOIRE_GEO">HISTOIRE_GEO</option>
          <option value="PHILOSOPHIE">PHILOSOPHIE</option>
          <option value="NSI">NSI</option>
          <option value="SVT">SVT</option>
          <option value="SES">SES</option>
        </select>

        <label className="text-sm font-medium">Message à ARIA</label>
        <textarea
          className="w-full border rounded p-2 h-40"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      <div className="flex gap-2 items-center">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          onClick={onGenerateViaAria}
          disabled={generating}
          data-testid="debug-generate-pdf-aria"
        >
          {generating ? 'Génération…' : 'Générer via ARIA (LLM)'}
        </button>
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50"
          onClick={onCompileMicroservice}
          disabled={compiling || !latex}
          data-testid="debug-compile-micro"
          title={!latex ? 'Aucun LaTeX extrait' : 'Compiler via le microservice PDF'}
        >
          {compiling ? 'Compilation…' : 'Compiler via microservice'}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {(url || compiledUrl) && (
        <div className="grid gap-2">
          {url && (
            <div className="mt-2 p-3 border rounded bg-green-50 text-green-800">
              <div className="text-sm">PDF ARIA prêt:</div>
              <a className="underline" href={url} target="_blank" rel="noreferrer">
                Télécharger (ARIA)
              </a>
            </div>
          )}
          {compiledUrl && (
            <div className="mt-2 p-3 border rounded bg-blue-50 text-blue-800">
              <div className="text-sm">PDF recompilé (microservice):</div>
              <a className="underline" href={compiledUrl} target="_blank" rel="noreferrer">
                Télécharger (Recompilation)
              </a>
            </div>
          )}
        </div>
      )}

      {/* Indicateurs de densité */}
      <div className="mt-4 border rounded p-3 bg-gray-50">
        <h2 className="font-semibold mb-2">Indicateurs de densité</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div>
            <span
              className={`px-2 py-1 rounded ${okWord ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
            >
              Mots: {metrics.wordCount} {okWord ? '(OK ≥ 1200)' : '(Viser 1200+)'}
            </span>
          </div>
          <div>
            <span className="px-2 py-1 rounded bg-gray-100 text-gray-800">
              Sections: {metrics.sectionCount} · Sous-sections: {metrics.subCount} · Subsub:{' '}
              {metrics.subsubCount}
            </span>
          </div>
          <div>
            <span
              className={`px-2 py-1 rounded ${okCorr ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
            >
              Exercices corrigés: {metrics.correctedExCount} {okCorr ? '(OK ≥ 3)' : '(Insuffisant)'}
            </span>
          </div>
          <div>
            <span
              className={`px-2 py-1 rounded ${okUncorr ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}
            >
              Non corrigés: {metrics.uncorrectedExCount}
              {metrics.hasUncorrSection ? '' : ' (section absente)'} {okUncorr ? '(OK ≥ 3)' : ''}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          NB: Comptes approximatifs via heuristiques regex sur le LaTeX.
        </p>
      </div>

      {resp && (
        <div className="mt-4">
          <h2 className="font-semibold mb-1">Réponse ARIA (texte brut)</h2>
          <pre className="text-xs whitespace-pre-wrap border rounded p-2 bg-gray-50 max-h-80 overflow-auto">
            {resp}
          </pre>
        </div>
      )}

      {latex && (
        <div className="mt-4">
          <h2 className="font-semibold mb-1">LaTeX extrait (debug)</h2>
          <textarea className="w-full h-80 border rounded p-2 text-xs font-mono" readOnly>
            {latex}
          </textarea>
        </div>
      )}
    </div>
  );
}
