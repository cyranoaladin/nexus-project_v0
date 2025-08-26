"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface UserItem {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

export default function AssistantUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'ASSISTANTE' | 'COACH' | 'PARENT' | 'ELEVE'>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push('/auth/signin');
      return;
    }
    fetch(`/api/assistant/users?role=${roleFilter}`)
      .then(r => r.ok ? r.json() : { users: [] })
      .then(data => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, status, router, roleFilter]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement des utilisateurs...</p>
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
              <Users className="w-6 h-6 text-blue-600" />
              <h1 className="font-semibold text-gray-900">Gestion des Utilisateurs</h1>
            </div>
            <Badge variant="outline">{users.length} {roleFilter === 'ALL' ? 'utilisateurs' : (roleFilter.toLowerCase() + (users.length > 1 ? 's' : ''))}</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Utilisateurs</CardTitle>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Filtrer:</label>
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                >
                  <option value="ALL">Tous</option>
                  <option value="ADMIN">Admin</option>
                  <option value="ASSISTANTE">Assistante</option>
                  <option value="COACH">Coach</option>
                  <option value="PARENT">Parent</option>
                  <option value="ELEVE">Élève</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <p className="text-sm text-gray-600">Aucun utilisateur.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">Nom</th>
                      <th className="text-left p-2">Email</th>
                      <th className="text-left p-2">Rôle</th>
                      <th className="text-left p-2">Créé le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="border-t">
                        <td className="p-2">{u.firstName} {u.lastName}</td>
                        <td className="p-2">{u.email}</td>
                        <td className="p-2">
                          <Badge variant={"outline" as 'default' | 'success' | 'outline' | 'popular' | 'warning' | 'destructive' | null | undefined}>{u.role}</Badge>
                        </td>
                        <td className="p-2">{new Date(u.createdAt).toLocaleString('fr-FR')}</td>
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


