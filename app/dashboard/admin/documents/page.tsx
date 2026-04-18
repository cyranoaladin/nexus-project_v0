'use client';

import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Upload, Users, X } from 'lucide-react';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface UploadedDoc {
  id: string;
  title: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export default function AdminDocumentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [uploaded, setUploaded] = useState<UploadedDoc[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin');
      return;
    }
    fetch('/api/admin/users?limit=200')
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .finally(() => setLoading(false));
  }, [session, status, router]);

  const handleUpload = async () => {
    if (!file || !selectedUser || !title.trim()) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('userId', selectedUser);
    fd.append('title', title.trim());
    try {
      const res = await fetch('/api/admin/documents', { method: 'POST', body: fd });
      if (res.ok) {
        setToast('Document envoyé avec succès');
        setFile(null);
        setTitle('');
        setSelectedUser('');
        if (fileRef.current) fileRef.current.value = '';
      } else {
        const err = await res.json();
        setToast(`Erreur : ${err.error}`);
      }
    } catch {
      setToast('Erreur réseau');
    } finally {
      setUploading(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl bg-surface-dark border border-white/10 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
          <button onClick={() => setToast(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-white">Gestion des Documents</h1>
        <p className="text-sm text-neutral-400 mt-1">Envoyez des fichiers aux élèves, parents ou coaches</p>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Upload className="h-4 w-4 text-brand-accent" />
            Envoyer un document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Destinataire</label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-brand-primary"
              >
                <option value="">Sélectionner un utilisateur…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-400 mb-1">Titre du document</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Bilan de la semaine blanche"
                className="w-full rounded-lg bg-white/5 border border-white/10 text-white text-sm px-3 py-2 focus:outline-none focus:border-brand-primary placeholder:text-neutral-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-400 mb-1">Fichier</label>
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-neutral-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-brand-primary/20 file:text-brand-accent hover:file:bg-brand-primary/30"
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={uploading || !file || !selectedUser || !title.trim()}
            className="bg-brand-primary hover:bg-brand-primary/90"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Envoyer
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-base text-white flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-accent" />
            <Users className="h-4 w-4 text-neutral-400" />
            {users.length} utilisateurs chargés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-400">
            Sélectionnez un destinataire ci-dessus pour lui envoyer un document. Les documents envoyés sont visibles dans la section <strong className="text-white">Ressources</strong> de son dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
