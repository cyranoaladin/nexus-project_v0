'use client';

import { useState } from 'react';

/**
 * GeoGebra applet embed component.
 * Loads a GeoGebra material by its ID in an iframe.
 */
export default function InteractiveGraph({
  geogebraId,
  title,
}: {
  geogebraId: string;
  title?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-900/50 border border-indigo-500/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📐</span>
          <span className="font-bold text-indigo-300 text-sm">
            {title ?? 'Graphique interactif GeoGebra'}
          </span>
        </div>
        <span className="text-slate-500 text-sm">
          {expanded ? '▲ Réduire' : '▼ Ouvrir'}
        </span>
      </button>

      {expanded && (
        <div className="relative" style={{ paddingBottom: '56.25%' }}>
          {!loaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-slate-500 text-xs">Chargement de GeoGebra...</p>
              </div>
            </div>
          )}
          <iframe
            src={`https://www.geogebra.org/material/iframe/id/${geogebraId}/width/800/height/450/border/888888/sfsb/true/smb/false/stb/false/stbh/false/ai/false/asb/false/sri/false/rc/false/ld/false/sdz/true/ctl/false`}
            width="800"
            height="450"
            className="absolute inset-0 w-full h-full border-0"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            title={title ?? 'GeoGebra'}
          />
        </div>
      )}
    </div>
  );
}
