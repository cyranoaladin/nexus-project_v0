'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade?: string;
  school?: string;
  creditBalance: number;
}

export default function AssistantStudentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push('/auth/signin');
      return;
    }

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/assistant/students/credits', { cache: 'no-store' });
        if (!res.ok) throw new Error('Erreur lors du chargement des élèves');
        setStudents(await res.json());
      } catch (e: any) {
        setError(e?.message || 'Erreur inattendue');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [status, session, router]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestion des Élèves</h1>
            <p className="text-gray-600 text-sm">Crédits et informations</p>
          </div>
        </div>

        {status === 'loading' || loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <div className="text-center text-red-600 py-8">{error}</div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Élèves ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-4">Élève</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Classe</th>
                    <th className="py-2 pr-4">Établissement</th>
                    <th className="py-2 pr-4">Crédits</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">{s.firstName} {s.lastName}</td>
                      <td className="py-2 pr-4">{s.email}</td>
                      <td className="py-2 pr-4">{s.grade || '-'}</td>
                      <td className="py-2 pr-4">{s.school || '-'}</td>
                      <td className="py-2 pr-4 font-semibold">{s.creditBalance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
