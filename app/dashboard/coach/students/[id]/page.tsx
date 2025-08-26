export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

interface Params {
  params: { id: string };
}

export default async function StudentProfilePage({ params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'COACH') return null;

  const coach = await prisma.coachProfile.findUnique({ where: { userId: session.user.id } });
  if (!coach) return notFound();

  const student = await prisma.student.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      sessions: {
        where: { coachId: coach.id },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
      },
      creditTransactions: { orderBy: { createdAt: 'desc' }, take: 10 },
      reports: { where: { coachId: coach.id }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!student) return notFound();

  const creditBalance = student.creditTransactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Profil élève</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 border rounded-md">
          <p className="text-sm text-gray-500">Nom</p>
          <p className="font-medium">
            {student.user.firstName} {student.user.lastName}
          </p>
        </div>
        <div className="p-4 border rounded-md">
          <p className="text-sm text-gray-500">Classe</p>
          <p className="font-medium">{student.grade ?? 'N/A'}</p>
        </div>
        <div className="p-4 border rounded-md">
          <p className="text-sm text-gray-500">Crédits</p>
          <p className="font-medium">{creditBalance}</p>
        </div>
      </div>

      <h2 className="text-xl font-semibold mt-4 mb-2">Dernières sessions</h2>
      <div className="border rounded-md divide-y">
        {student.sessions.length === 0 ? (
          <p className="p-3 text-gray-600">Aucune session.</p>
        ) : (
          student.sessions.map((s) => (
            <div key={s.id} className="p-3 text-sm flex justify-between">
              <span>
                {s.title} • {new Date(s.scheduledAt).toLocaleString('fr-FR')}
              </span>
              <span className="text-gray-500">{s.status}</span>
            </div>
          ))
        )}
      </div>

      <h2 className="text-xl font-semibold mt-6 mb-2">Rapports</h2>
      <div className="border rounded-md divide-y">
        {student.reports.length === 0 ? (
          <p className="p-3 text-gray-600">Aucun rapport.</p>
        ) : (
          student.reports.map((r) => (
            <div key={r.id} className="p-3 text-sm">
              <p className="font-medium">
                {r.title} • {r.period}
              </p>
              <p className="text-gray-600 text-xs">
                {new Date(r.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
