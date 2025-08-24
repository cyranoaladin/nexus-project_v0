export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export default async function AssistantCreditsPage() {
  const credits = await prisma.creditTransaction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      student: { include: { user: true } },
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6" data-testid="assistante-credits">
      <h1 className="text-2xl font-semibold mb-4">Gestion des Crédits</h1>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Élève</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Montant</th>
              <th className="text-left p-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {credits.map(cr => (
              <tr key={cr.id} className="border-t">
                <td className="p-2">{cr.student?.user.firstName} {cr.student?.user.lastName}</td>
                <td className="p-2">{cr.type}</td>
                <td className="p-2">{cr.amount}</td>
                <td className="p-2">{cr.createdAt.toISOString().slice(0,10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
