"use client";

import { useEffect, useState } from 'react';
import { Subject } from "@/types/enums";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BookOpen, ExternalLink, Copy } from 'lucide-react';

const SUBJECTS_OPTIONS = [
  { value: "all", label: "Toutes les matières" },
  { value: Subject.MATHEMATIQUES, label: "Mathématiques" },
  { value: Subject.NSI, label: "NSI" },
  { value: Subject.FRANCAIS, label: "Français" },
  { value: Subject.PHILOSOPHIE, label: "Philosophie" },
  { value: Subject.HISTOIRE_GEO, label: "Histoire-Géographie" },
  { value: Subject.ANGLAIS, label: "Anglais" },
  { value: Subject.ESPAGNOL, label: "Espagnol" },
  { value: Subject.PHYSIQUE_CHIMIE, label: "Physique-Chimie" },
  { value: Subject.SVT, label: "SVT" },
  { value: Subject.SES, label: "SES" }
];

interface ResourceItem {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: string;
  lastUpdated: string;
}

export default function RessourcesPageClient() {
  const [subject, setSubject] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [total, setTotal] = useState<number>(0);
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchResources = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ subject, page: String(page), pageSize: String(pageSize) });
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/student/resources?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Erreur de chargement des ressources');
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      setError(e?.message || 'Erreur inattendue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, page, pageSize]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ressources Pédagogiques</h1>
            <p className="text-gray-600 text-sm">Fiches, exercices et méthodes issues de la base Nexus</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-56">
              <Select value={subject} onValueChange={(v) => { setSubject(v); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Matière" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-72">
              <Input
                placeholder="Rechercher un titre, un mot-clé..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchResources(); }}
              />
            </div>
            <Button onClick={() => { setPage(1); fetchResources(); }}>Rechercher</Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-gray-600">Chargement...</div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      <a className="hover:underline" href={`/dashboard/eleve/ressources/${r.id}`}>{r.title}</a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/dashboard/eleve/ressources/${r.id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-1" /> Ouvrir
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={async () => {
                        const url = `${window.location.origin}/dashboard/eleve/ressources/${r.id}`;
                        try { await navigator.clipboard.writeText(url); } catch {}
                      }}>
                        <Copy className="w-4 h-4 mr-1" /> Copier
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-700 space-y-2">
                  <div className="text-gray-600">{r.description}</div>
                  <div className="text-xs text-gray-500">{r.type} • {new Date(r.lastUpdated).toLocaleDateString('fr-FR')}</div>
                </CardContent>
              </Card>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-gray-600">Aucune ressource trouvée pour ce filtre.</div>
            )}
          </div>
        )}
        {(!loading && !error) && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-600">{items.length > 0 ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} sur ${total}` : `0 sur ${total}`}</div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Précédent</Button>
              <Button variant="outline" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

