export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
//

export default async function EleveRessourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ELEVE') {
    return null;
  }

  const ressources = await prisma.pedagogicalContent.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6" data-testid="eleve-ressources">
      <h1 className="text-2xl font-semibold mb-4">Ressources Pédagogiques</h1>
      {ressources.length === 0 ? (
        <p className="text-gray-600">Aucune ressource disponible.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ressources.map((r) => (
            <div key={r.id} className="border rounded-md p-3 bg-white">
              <h3 className="font-medium">{r.title}</h3>
              <p className="text-sm text-gray-600 mt-1 line-clamp-3">{r.content.slice(0, 240)}...</p>
              <div className="text-xs text-gray-500 mt-2">{r.subject}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
