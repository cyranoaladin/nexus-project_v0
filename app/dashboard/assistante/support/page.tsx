"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface TicketItem {
  id: string;
  fromEmail: string;
  title: string;
  createdAt: string;
  status: string;
}

export default function AssistantSupportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push('/auth/signin');
      return;
    }
    // Placeholder: list last messages as tickets when API exists
    fetch('/api/assistant/notifications')
      .then(r => r.ok ? r.json() : { notifications: [] })
      .then(data => {
        const items = (data.notifications || []).slice(0, 20).map((n: any) => ({
          id: n.id,
          fromEmail: n.userEmail || 'parent@nexus.tn',
          title: n.title || 'Message client',
          createdAt: n.createdAt,
          status: n.read ? 'READ' : 'PENDING',
        }));
        setTickets(items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement du support...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Mail className="w-6 h-6 text-purple-600" />
              <h1 className="font-semibold text-gray-900">Support Client</h1>
            </div>
            <Badge variant="outline">{tickets.length} tickets</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Messages récents</CardTitle>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <p className="text-sm text-gray-600">Aucun ticket disponible.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">De</th>
                      <th className="text-left p-2">Sujet</th>
                      <th className="text-left p-2">Statut</th>
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map(t => (
                      <tr key={t.id} className="border-t">
                        <td className="p-2">{t.fromEmail}</td>
                        <td className="p-2">{t.title}</td>
                        <td className="p-2">
                          <Badge variant={(t.status === 'PENDING' ? 'outline' : 'default') as 'default' | 'success' | 'outline' | 'popular' | 'warning' | 'destructive' | null | undefined}>{t.status}</Badge>
                        </td>
                        <td className="p-2">{new Date(t.createdAt).toLocaleString('fr-FR')}</td>
                        <td className="p-2">
                          <Button size="sm" variant="outline">Ouvrir</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}


