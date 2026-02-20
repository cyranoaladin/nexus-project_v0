import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { UserRole } from '@prisma/client';
import { DocumentUploadForm } from '@/components/admin/DocumentUploadForm';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Gestion des Documents | Nexus Réussite',
  description: 'Partage de documents sécurisés avec les élèves et parents.',
};

export default async function AdminDocumentsPage() {
  // Server-side RBAC check
  const sessionOrResponse = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  
  if (isErrorResponse(sessionOrResponse)) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
          Documents & Ressources
        </h1>
        <p className="text-slate-500 text-lg max-w-2xl">
          Déposez ici les bilans, corrections et supports pédagogiques. Ils seront stockés dans le coffre-fort sécurisé et accessibles uniquement par le destinataire.
        </p>
      </div>

      <DocumentUploadForm />
    </div>
  );
}
