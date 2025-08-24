export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function CoachReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'COACH') return null;

  const coach = await prisma.coachProfile.findUnique({ where: { userId: session.user.id } });
  const reports = coach ? await prisma.studentReport.findMany({
    where: { coachId: coach.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Mes rapports</h1>
        <a href="/dashboard/coach/reports/new" className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm">Nouveau rapport</a>
      </div>
      {reports.length === 0 ? (
        <p className="text-gray-600">Aucun rapport rédigé.</p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Titre</th>
                <th className="text-left p-2">Période</th>
                <th className="text-left p-2">Sessions</th>
                <th className="text-left p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.title}</td>
                  <td className="p-2">{r.period}</td>
                  <td className="p-2">{r.sessionsCount}</td>
                  <td className="p-2">{new Date(r.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


