export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function CoachMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'COACH') return null;

  const messages = await prisma.message.findMany({
    where: { receiverId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Messages Élèves</h1>
      {messages.length === 0 ? (
        <p className="text-gray-600">Aucun message.</p>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">De</th>
                <th className="text-left p-2">Contenu</th>
                <th className="text-left p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {messages.map(m => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{m.senderId}</td>
                  <td className="p-2">{m.content}</td>
                  <td className="p-2">{new Date(m.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


