// components/bilan/BilanSynthese.tsx
"use client";
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarScores } from './RadarScores';

export function BilanSynthese({
  entries,
  forces,
  faiblesses,
  offre,
  alternatives,
  feuilleDeRoute,
}: {
  entries: Array<{ domain: string; percent: number }>;
  forces: string[];
  faiblesses: string[];
  offre: string;
  alternatives: string[];
  feuilleDeRoute: string[];
}) {
  return (
    <Card className="border border-slate-200">
      <CardHeader>
        <CardTitle>Synthèse — 1 page</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <RadarScores data={entries} />
        </div>
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold">Forces</h4>
            <ul className="list-disc list-inside text-sm">
              {(forces||[]).slice(0,3).map((x, i)=>(<li key={i}>{x}</li>))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Axes de progression</h4>
            <ul className="list-disc list-inside text-sm">
              {(faiblesses||[]).slice(0,3).map((x, i)=>(<li key={i}>{x}</li>))}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Offre Nexus recommandée</h4>
            <p className="text-sm">{offre || '—'}</p>
            {Array.isArray(alternatives) && alternatives.length>0 && (
              <p className="text-xs text-slate-600">Alternatives: {alternatives.join(', ')}</p>
            )}
          </div>
          <div>
            <h4 className="font-semibold">Mini feuille de route</h4>
            <ul className="list-disc list-inside text-sm">
              {(feuilleDeRoute||[]).slice(0,3).map((x, i)=>(<li key={i}>{x}</li>))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

