"use client";

import { Button } from "@/components/ui/button";
import RadarChart from "./RadarChart";
import OffersPanel from "./OffersPanel";

export default function ResultsPanel({ result, onPrev, onSubmit }: { result: any; onPrev: () => void; onSubmit: (opts: { emailStudent?: boolean; emailParent?: boolean }) => void; }) {
  if (!result) return null;
  const domains = Object.entries(result.qcmScores.byDomain || {}).map(([domain, ds]: any) => ({ domain, percent: ds.percent }));

  const downloadHref = result.savedBilanId ? `/api/bilan/pdf/${result.savedBilanId}` : undefined;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Résultats</h3>
      <RadarChart data={domains as any} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-3 border rounded">
          <h4 className="font-medium mb-2">Forces</h4>
          <ul className="list-disc list-inside text-sm">
            {(result.synthesis.forces || []).map((f: string) => <li key={f}>{f}</li>)}
          </ul>
        </div>
        <div className="p-3 border rounded">
          <h4 className="font-medium mb-2">Faiblesses</h4>
          <ul className="list-disc list-inside text-sm">
            {(result.synthesis.faiblesses || []).map((f: string) => <li key={f}>{f}</li>)}
          </ul>
        </div>
      </div>
      <div className="p-3 border rounded">
        <h4 className="font-medium mb-2">Feuille de route</h4>
        <ul className="list-disc list-inside text-sm space-y-1">
          {(result.synthesis.feuilleDeRoute || []).map((l: string, i: number) => <li key={i}>{l}</li>)}
        </ul>
      </div>
      <div className="p-3 border rounded">
        <h4 className="font-medium mb-2">Offres proposées</h4>
        <OffersPanel offers={result.offers} />
      </div>
      <div className="flex flex-wrap gap-3 justify-between">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onPrev()}>Précédent</Button>
          <Button onClick={() => onSubmit({ emailStudent: true, emailParent: true })}>Enregistrer & Envoyer par e‑mail</Button>
        </div>
        {downloadHref ? (
          <a className="inline-flex items-center px-4 py-2 border rounded bg-white hover:bg-gray-50" href={downloadHref} target="_blank" rel="noreferrer">Télécharger PDF</a>
        ) : (
          <span className="text-sm text-gray-500">PDF disponible après enregistrement</span>
        )}
      </div>
    </div>
  );
}
