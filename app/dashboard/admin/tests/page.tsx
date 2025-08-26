import { prisma } from '@/lib/prisma';

export default async function AdminTestsPage() {
  const [dbOk, users, payments] = await Promise.all([
    prisma.$queryRaw`SELECT 1 as ok`.then(() => true).catch(() => false),
    prisma.user.count(),
    prisma.payment.count(),
  ]);

  const checks = [
    { name: 'DATABASE_URL', ok: Boolean(process.env.DATABASE_URL) },
    { name: 'NEXTAUTH_URL', ok: Boolean(process.env.NEXTAUTH_URL) },
    { name: 'NEXTAUTH_SECRET', ok: Boolean(process.env.NEXTAUTH_SECRET) },
    { name: 'OPENAI_API_KEY', ok: Boolean(process.env.OPENAI_API_KEY) },
    { name: 'DB connectivity', ok: dbOk },
    { name: 'Users seeded', ok: users > 0 },
    { name: 'Payments seeded', ok: payments > 0 },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-2xl font-semibold">Tests Système</h1>
      <div className="border rounded-md overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Vérification</th>
              <th className="text-left p-2">Statut</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.name} className="border-t">
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.ok ? 'OK' : 'KO'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
