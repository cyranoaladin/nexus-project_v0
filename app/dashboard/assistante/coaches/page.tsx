export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export default async function AssistantCoachesPage() {
  const coaches = await prisma.coachProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6" data-testid="assistante-coaches">
      <h1 className="text-2xl font-semibold mb-4">Gestion des Coachs</h1>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Nom</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Pseudonyme</th>
              <th className="text-left p-2">Matières</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map(c => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.user.firstName} {c.user.lastName}</td>
                <td className="p-2">{c.user.email}</td>
                <td className="p-2">{c.pseudonym || '-'}</td>
                <td className="p-2">{Array.isArray(c.subjects) ? (c.subjects as any).join(', ') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
