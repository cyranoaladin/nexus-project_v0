import { prisma } from '@/lib/prisma';

export default async function AdminAnalyticsPage() {
  const [usersCount, sessionsCount, subsCount, payments] = await Promise.all([
    prisma.user.count(),
    prisma.session.count(),
    prisma.subscription.count(),
    prisma.payment.findMany({ select: { amount: true, status: true, createdAt: true } }),
  ]);
  const totalRevenue = payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + (p.amount || 0), 0);

  // Regroupement revenus par jour (7 derniers jours)
  const now = new Date();
  const days: { date: string; amount: number; }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0,10);
    const amount = payments
      .filter(p => p.status === 'COMPLETED' && p.createdAt && new Date(p.createdAt).toISOString().slice(0,10) === key)
      .reduce((s, p) => s + (p.amount || 0), 0);
    days.push({ date: key, amount });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 border rounded-md">
          <div className="text-gray-500 text-sm">Revenus (TND)</div>
          <div className="text-2xl font-bold">{totalRevenue}</div>
        </div>
        <div className="p-4 border rounded-md">
          <div className="text-gray-500 text-sm">Utilisateurs</div>
          <div className="text-2xl font-bold">{usersCount}</div>
        </div>
        <div className="p-4 border rounded-md">
          <div className="text-gray-500 text-sm">Sessions</div>
          <div className="text-2xl font-bold">{sessionsCount}</div>
        </div>
        <div className="p-4 border rounded-md">
          <div className="text-gray-500 text-sm">Abonnements</div>
          <div className="text-2xl font-bold">{subsCount}</div>
        </div>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Jour</th>
              <th className="text-left p-2">Revenus (TND)</th>
            </tr>
          </thead>
          <tbody>
            {days.map(d => (
              <tr key={d.date} className="border-t">
                <td className="p-2">{d.date}</td>
                <td className="p-2">{d.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
