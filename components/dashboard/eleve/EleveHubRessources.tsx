'use client';

import { BookOpen, Download, FileText, HardDrive, BadgeCheck, User, Receipt, FileCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { EleveHub, EleveHubResourceCategory, EleveHubResourceBadge } from './types';

type EleveHubRessourcesProps = {
  hub: EleveHub;
};

const CATEGORY_LABELS: Record<EleveHubResourceCategory, string> = {
  INTERACTIVE_PROGRAM: 'Interfaces interactives',
  OFFICIAL_PROGRAM: 'Programme Officiel',
  OFFICIAL_AUTOMATISMES: 'Automatismes EAM',
  OFFICIAL_SUJET: 'Sujets & Exemples',
  COACH_RESOURCE: 'Ressources Coach',
  USER_DOCUMENT: 'Documents Personnels',
  RAG_REFERENCE: 'Références ARIA',
  INVOICE: 'Factures',
  RECEIPT: 'Reçus',
  STAGE_BILAN: 'Bilans de Stage',
};

const CATEGORY_ICONS: Record<EleveHubResourceCategory, React.ElementType> = {
  INTERACTIVE_PROGRAM: BookOpen,
  OFFICIAL_PROGRAM: BookOpen,
  OFFICIAL_AUTOMATISMES: BadgeCheck,
  OFFICIAL_SUJET: FileText,
  COACH_RESOURCE: User,
  USER_DOCUMENT: HardDrive,
  RAG_REFERENCE: FileText,
  INVOICE: Receipt,
  RECEIPT: FileCheck,
  STAGE_BILAN: FileText,
};

const BADGE_STYLES: Record<EleveHubResourceBadge, string> = {
  OFFICIEL: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  COACH: 'bg-brand-accent/20 text-brand-accent border-brand-accent/30',
  PERSONNEL: 'bg-white/5 text-neutral-300 border-white/10',
  NOUVEAU: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  INTERACTIF: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getCategoryOrder(category: EleveHubResourceCategory): number {
  const order: Record<EleveHubResourceCategory, number> = {
    INTERACTIVE_PROGRAM: 0,
    OFFICIAL_PROGRAM: 1,
    OFFICIAL_AUTOMATISMES: 2,
    OFFICIAL_SUJET: 3,
    COACH_RESOURCE: 4,
    USER_DOCUMENT: 5,
    RAG_REFERENCE: 6,
    STAGE_BILAN: 7,
    INVOICE: 8,
    RECEIPT: 9,
  };
  return order[category] ?? 999;
}

export function EleveHubRessources({ hub }: EleveHubRessourcesProps) {
  const categories = Object.keys(hub.byCategory) as EleveHubResourceCategory[];
  const sortedCategories = categories.sort((a, b) => getCategoryOrder(a) - getCategoryOrder(b));

  return (
    <section id="hub-resources" aria-labelledby="hub-resources-title">
      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="hub-resources-title" className="flex items-center gap-2 text-white">
            <HardDrive className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            Hub Ressources Pédagogiques
            <Badge variant="outline" className="ml-2 border-brand-accent/30 text-brand-accent">
              {hub.totalCount}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {hub.totalCount === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <FileText className="h-10 w-10 text-neutral-500" aria-hidden="true" />
              <p className="text-sm text-neutral-400">Aucune ressource disponible pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedCategories.map((category) => {
                const resources = hub.byCategory[category];
                if (resources.length === 0) return null;

                const CategoryIcon = CATEGORY_ICONS[category];
                const categoryLabel = CATEGORY_LABELS[category];

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-3">
                      <CategoryIcon className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                      <h3 className="text-sm font-semibold text-white">{categoryLabel}</h3>
                      <Badge variant="outline" className="text-xs border-white/20 text-neutral-300">
                        {resources.length}
                      </Badge>
                    </div>
                    <ul className="space-y-2" role="list">
                      {resources.map((resource) => (
                        <li key={resource.id}>
                          {resource.downloadUrl ? (
                            <a
                              href={resource.downloadUrl}
                              download
                              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:border-brand-accent/40 hover:bg-brand-accent/5 transition-colors group"
                              aria-label={`Télécharger ${resource.title}`}
                            >
                              <FileText className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden="true" />
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium text-neutral-100 group-hover:text-white">
                                  {resource.title}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {resource.subtitle}
                                  {resource.sizeBytes != null ? ` · ${formatBytes(resource.sizeBytes)}` : ''}
                                </p>
                                {resource.uploaderName && (
                                  <p className="text-xs text-brand-accent/70">
                                    {resource.uploaderName}
                                  </p>
                                )}
                              </div>
                              {resource.badge && (
                                <Badge className={BADGE_STYLES[resource.badge]} variant="outline">
                                  {resource.badge === 'OFFICIEL' && 'OFFICIEL'}
                                  {resource.badge === 'COACH' && 'COACH'}
                                  {resource.badge === 'PERSONNEL' && 'PERSONNEL'}
                                  {resource.badge === 'NOUVEAU' && 'NOUVEAU'}
                                  {resource.badge === 'INTERACTIF' && 'INTERACTIF'}
                                </Badge>
                              )}
                              <Download
                                className="h-4 w-4 shrink-0 text-neutral-500 group-hover:text-brand-accent transition-colors"
                                aria-hidden="true"
                              />
                            </a>
                          ) : resource.externalUrl ? (
                            <a
                              href={resource.externalUrl}
                              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 hover:border-brand-accent/40 hover:bg-brand-accent/5 transition-colors group"
                              aria-label={`Voir ${resource.title}`}
                            >
                              <FileText className="h-5 w-5 shrink-0 text-brand-accent" aria-hidden="true" />
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-medium text-neutral-100 group-hover:text-white">
                                  {resource.title}
                                </p>
                                <p className="text-xs text-neutral-500">{resource.subtitle}</p>
                              </div>
                              <Badge
                                className={resource.badge ? BADGE_STYLES[resource.badge] : 'text-xs bg-blue-500/20 text-blue-300 border-blue-500/30'}
                                variant="outline"
                              >
                                {resource.badge ?? 'LIEN'}
                              </Badge>
                            </a>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
