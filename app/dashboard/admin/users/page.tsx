import { prisma } from '@/lib/prisma';

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      parentProfile: { select: { id: true } },
      studentProfile: { select: { id: true } },
      coachProfile: { select: { id: true, pseudonym: true } },
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Gestion des Utilisateurs</h1>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Nom</th>
              <th className="text-left p-2">Rôle</th>
              <th className="text-left p-2">Profils</th>
              <th className="text-left p-2">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2 font-mono">{u.email}</td>
                <td className="p-2">
                  {[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}
                </td>
                <td className="p-2">
                  <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">{u.role}</span>
                </td>
                <td className="p-2">
                  {u.parentProfile ? 'Parent' : ''}
                  {u.studentProfile ? (u.parentProfile ? ' • Élève' : 'Élève') : ''}
                  {u.coachProfile
                    ? `${u.parentProfile || u.studentProfile ? ' • ' : ''}Coach${u.coachProfile.pseudonym ? ` (${u.coachProfile.pseudonym})` : ''}`
                    : ''}
                  {!u.parentProfile && !u.studentProfile && !u.coachProfile ? '—' : ''}
                </td>
                <td className="p-2">{new Date(u.createdAt).toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
