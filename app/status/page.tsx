"use client";

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json());

function StatusBadge({ ok, ms }: { ok: boolean; ms?: number }) {
  if (ok) return <Badge variant="success">OK {typeof ms === 'number' ? `(${ms}ms)` : ''}</Badge>;
  return <Badge variant="destructive">DOWN</Badge>;
}

export default function StatusPage() {
  const { data, isLoading, mutate } = useSWR('/api/status', fetcher, { refreshInterval: 15000 });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Statut Système</h1>
          <Button onClick={() => mutate()} variant="outline">Rafraîchir</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Résumé</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && <p>Chargement...</p>}
            {!isLoading && data && (
              <div className="space-y-2">
                <p>Statut global: <Badge variant={data.status === 'ok' ? 'success' : data.status === 'degraded' ? 'warning' : 'destructive'}>{data.status}</Badge></p>
                <p>Horodatage: {new Date(data.timestamp).toLocaleString()}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Base de Données</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.app ? (
                <div className="space-y-1">
                  <div>Connexion: <StatusBadge ok={!!data.app.db?.connected} ms={data.app.db?.ms} /></div>
                  <div>Users: <Badge variant="outline">{data.app.db?.userCount ?? 0}</Badge></div>
                </div>
              ) : <p>—</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>RAG Service</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.services ? (
                <StatusBadge ok={!!data.services.rag?.ok} ms={data.services.rag?.ms} />
              ) : <p>—</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>LLM Service</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.services ? (
                <StatusBadge ok={!!data.services.llm?.ok} ms={data.services.llm?.ms} />
              ) : <p>—</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PDF Generator</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.services ? (
                <StatusBadge ok={!!data.services.pdf?.ok} ms={data.services.pdf?.ms} />
              ) : <p>—</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

