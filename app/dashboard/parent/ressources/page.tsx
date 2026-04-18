'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, File, FileText, HardDrive, Image as ImageIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface UserDoc {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) return <FileText className="w-8 h-8 text-rose-400" />;
  if (mimeType.includes('image')) return <ImageIcon className="w-8 h-8 text-emerald-400" />;
  if (mimeType.includes('word') || mimeType.includes('document')) return <FileText className="w-8 h-8 text-sky-400" />;
  return <File className="w-8 h-8 text-neutral-400" />;
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ParentRessourcesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [docs, setDocs] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'PARENT') {
      router.push('/auth/signin');
      return;
    }
    fetch('/api/student/documents')
      .then((r) => r.json())
      .then((data) => setDocs(data.documents ?? []))
      .finally(() => setLoading(false));
  }, [session, status, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parent" className="text-neutral-400 hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-white">Mes Ressources</h1>
          <p className="text-sm text-neutral-400 mt-1">Documents partagés avec vous par l'équipe Nexus</p>
        </div>
      </div>

      {docs.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-16 text-center">
            <HardDrive className="h-12 w-12 text-neutral-500 mx-auto mb-4" />
            <p className="text-neutral-300 font-medium">Aucun document disponible</p>
            <p className="text-neutral-500 text-sm mt-1">Les ressources partagées apparaîtront ici.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="bg-white/5 border-white/10 hover:border-brand-accent/40 transition-colors">
              <CardContent className="p-4 flex items-start gap-3">
                {getFileIcon(doc.mimeType)}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{doc.title}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{formatSize(doc.sizeBytes)}</p>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
