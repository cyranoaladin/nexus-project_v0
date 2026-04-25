'use client';

import { Download, FileText, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EleveResource, EleveResourceType } from './types';

type EleveResourcesProps = {
  resources: EleveResource[];
};

const TYPE_LABELS: Record<EleveResourceType, string> = {
  USER_DOCUMENT: 'Document',
  COACH_RESOURCE: 'Ressource coach',
  RAG_REFERENCE: 'Fiche de révision',
  INVOICE: 'Facture',
  RECEIPT: 'Reçu',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function EleveResources({ resources }: EleveResourcesProps) {
  return (
    <section id="resources" aria-labelledby="eleve-resources-title">
      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="eleve-resources-title" className="flex items-center gap-2 text-white">
            <HardDrive className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            Mes ressources
          </CardTitle>
        </CardHeader>
        <CardContent>
          {resources.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileText className="h-10 w-10 text-neutral-500" aria-hidden="true" />
              <p className="text-sm text-neutral-400">Aucune ressource disponible pour le moment.</p>
            </div>
          ) : (
            <ul className="space-y-2" role="list">
              {resources.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.downloadUrl}
                    download
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:border-brand-accent/40 hover:bg-brand-accent/5 transition-colors group"
                    aria-label={`Télécharger ${r.title}`}
                  >
                    <FileText className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-100 group-hover:text-white">
                        {r.title}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {TYPE_LABELS[r.type]}
                        {r.sizeBytes != null ? ` · ${formatBytes(r.sizeBytes)}` : ''}
                        {' · '}
                        {new Date(r.uploadedAt).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Download
                      className="h-4 w-4 shrink-0 text-neutral-500 group-hover:text-brand-accent transition-colors"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
