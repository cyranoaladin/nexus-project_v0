import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { FileText, Image as ImageIcon, File, Download, Calendar, HardDrive } from 'lucide-react';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const metadata = {
  title: 'Mes Ressources | Nexus Réussite',
  description: 'Accédez à vos documents pédagogiques et administratifs.',
};

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-slate-500" />;
  if (mimeType.includes('image')) return <ImageIcon className="w-8 h-8 text-green-500" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-8 h-8 text-blue-500" />;
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText className="w-8 h-8 text-emerald-600" />;
  return <File className="w-8 h-8 text-slate-300" />;
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default async function StudentResourcesPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Fetch documents securely via Prisma (Server Component)
  const documents = await prisma.userDocument.findMany({
    where: {
      userId: session.user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
          <HardDrive className="w-8 h-8 text-primary-600" />
          Mes Ressources
        </h1>
        <p className="text-slate-500 text-lg">
          Retrouvez ici tous les documents partagés par l'équipe Nexus (bilans, corrections, factures).
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <File className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">Aucun document disponible</h3>
          <p className="text-slate-500 mt-1">Vos ressources apparaîtront ici dès qu'elles seront partagées.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => (
            <div 
              key={doc.id} 
              className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
            >
              <div className="p-5 flex items-start gap-4 flex-1">
                <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-primary-50 transition-colors">
                  {getFileIcon(doc.mimeType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate" title={doc.title}>
                    {doc.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(doc.createdAt), 'd MMM yyyy', { locale: fr })}
                    </span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span>{formatSize(doc.sizeBytes)}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {doc.originalName.split('.').pop()?.toUpperCase() || 'FILE'}
                </span>
                <a 
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
