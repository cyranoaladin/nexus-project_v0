"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Calendar, Download, File, FileText, HardDrive, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <FileText className="w-8 h-8 text-emerald-400" />;
  return <File className="w-8 h-8 text-neutral-400" />;
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function StudentResourcesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [documents, setDocuments] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push("/auth/signin");
      return;
    }

    const fetchDocuments = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/student/documents');
        if (!response.ok) throw new Error('Impossible de charger vos ressources');
        const data = await response.json();
        setDocuments(data.documents ?? data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement de vos ressources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <header className="bg-surface-card/80 shadow-sm border-b border-white/10 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button variant="ghost" asChild className="mr-4">
              <Link href="/dashboard/eleve">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour au Dashboard
              </Link>
            </Button>
            <div>
              <h1 className="font-semibold text-white flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-brand-accent" />
                Mes Ressources
              </h1>
              <p className="text-sm text-neutral-400">Documents pédagogiques et administratifs</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="text-center py-12">
            <p className="text-rose-200 mb-4">Erreur : {error}</p>
            <Button onClick={() => window.location.reload()} className="btn-primary">
              Réessayer
            </Button>
          </div>
        )}

        {!error && documents.length === 0 && (
          <Card className="bg-white/5 border border-white/10">
            <CardContent className="text-center py-16">
              <div className="mx-auto w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <File className="w-8 h-8 text-neutral-500" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Aucun document disponible</h3>
              <p className="text-neutral-400 text-sm mb-6">
                Vos ressources apparaîtront ici dès qu&apos;elles seront partagées par l&apos;équipe Nexus.
              </p>
              <p className="text-neutral-500 text-xs flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-accent" />
                Bilans, corrections, factures — tout au même endroit.
              </p>
            </CardContent>
          </Card>
        )}

        {!error && documents.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <Card
                key={doc.id}
                className="bg-white/5 border border-white/10 hover:border-brand-accent/30 hover:shadow-premium transition-all duration-200 group"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/5 rounded-lg group-hover:bg-brand-accent/10 transition-colors">
                      {getFileIcon(doc.mimeType)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate" title={doc.title}>
                        {doc.title}
                      </h3>
                      <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(doc.createdAt)}
                        </span>
                        <span className="w-1 h-1 bg-neutral-600 rounded-full" />
                        <span>{formatSize(doc.sizeBytes)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {doc.originalName.split('.').pop()?.toUpperCase() || 'FILE'}
                    </span>
                    <a
                      href={`/api/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-brand-accent hover:text-brand-accent/80 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
