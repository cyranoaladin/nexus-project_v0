export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';

export default async function AssistantStudentsPage() {
  const students = await prisma.student.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true, parent: { include: { user: true } } },
    take: 100,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6" data-testid="assistante-students">
      <h1 className="text-2xl font-semibold mb-4">Gestion des Élèves</h1>
      <div className="border rounded-md overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Nom</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Parent</th>
              <th className="text-left p-2">Niveau</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className="border-t">
                <td className="p-2">{s.user.firstName} {s.user.lastName}</td>
                <td className="p-2">{s.user.email}</td>
                <td className="p-2">{s.parent?.user.firstName} {s.parent?.user.lastName}</td>
                <td className="p-2">{(s as any).grade || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
