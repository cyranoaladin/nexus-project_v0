import { prisma } from '@/lib/prisma';

export default async function AdminSubscriptionsPage() {
  const subs = await prisma.subscription.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Gestion des Abonnements</h1>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm" data-testid="subscriptions-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Élève</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Plan</th>
              <th className="text-left p-2">Prix (TND)</th>
              <th className="text-left p-2">Crédits/mois</th>
              <th className="text-left p-2">Statut</th>
              <th className="text-left p-2">ARIA</th>
              <th className="text-left p-2">Début</th>
              <th className="text-left p-2">Fin</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const studentName =
                `${s.student?.user?.firstName ?? ''} ${s.student?.user?.lastName ?? ''}`.trim() ||
                '—';
              const email = s.student?.user?.email ?? '—';
              const aria = (() => {
                try {
                  return JSON.parse(s.ariaSubjects || '[]').join(', ') || '—';
                } catch {
                  return '—';
                }
              })();
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-2">{studentName}</td>
                  <td className="p-2 font-mono">{email}</td>
                  <td className="p-2">{s.planName}</td>
                  <td className="p-2">{s.monthlyPrice}</td>
                  <td className="p-2">{s.creditsPerMonth}</td>
                  <td className="p-2">
                    <span className="px-2 py-1 rounded bg-purple-50 text-purple-700">
                      {s.status}
                    </span>
                  </td>
                  <td className="p-2">{aria}</td>
                  <td className="p-2">{new Date(s.startDate).toLocaleDateString('fr-FR')}</td>
                  <td className="p-2">
                    {s.endDate ? new Date(s.endDate).toLocaleDateString('fr-FR') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
