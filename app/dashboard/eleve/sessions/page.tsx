export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function EleveSessionsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ELEVE') {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6" data-testid="eleve-sessions">
        <p className="text-gray-600">Erreur lors du chargement</p>
      </div>
    );
  }

  const student = await prisma.student.findUnique({
    where: { userId: session.user.id },
    include: { sessions: { orderBy: { scheduledAt: 'desc' }, include: { coach: true } } },
  });

  const sessions = student?.sessions ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6" data-testid="eleve-sessions">
      <h1 className="text-2xl font-semibold mb-4" data-testid="eleve-sessions-title">Réserver une Session</h1>
      {sessions.length === 0 ? (
        <p className="text-gray-600" data-testid="no-sessions">Aucune session.</p>
      ) : (
        <div className="border rounded-md overflow-x-auto" data-testid="sessions-table">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Heure</th>
                <th className="text-left p-2">Matière</th>
                <th className="text-left p-2">Coach</th>
                <th className="text-left p-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t" data-testid={`session-row-${s.id}`}>
                  <td className="p-2">{new Date(s.scheduledAt).toLocaleDateString('fr-FR')}</td>
                  <td className="p-2">
                    {new Date(s.scheduledAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-2">{s.subject}</td>
                  <td className="p-2">{(s as any).coach?.pseudonym || '-'}</td>
                  <td className="p-2">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
