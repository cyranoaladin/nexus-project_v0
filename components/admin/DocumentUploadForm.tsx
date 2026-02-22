'use client';

import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileText, Search, CheckCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Types pour la recherche utilisateur
interface UserResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: 'ELEVE' | 'PARENT';
}

export function DocumentUploadForm() {
  // État du formulaire
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // État de la recherche
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
            setShowResults(true);
          }
        } catch (error) {
          console.error('Search error', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Configuration Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selected = acceptedFiles[0];
      // Validation taille (10MB)
      if (selected.size > 10 * 1024 * 1024) {
        toast.error('Le fichier dépasse la limite de 10MB');
        return;
      }
      setFile(selected);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  // Soumission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedUser) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', selectedUser.id);

    try {
      const res = await fetch('/api/admin/documents', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      toast.success('Document uploadé avec succès');
      // Reset form
      setFile(null);
      setSelectedUser(null);
      setSearchQuery('');
    } catch (error) {
      toast.error("Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
          <UploadCloud className="w-6 h-6 text-primary-600" />
          Déposer un document
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Sélectionnez un élève ou parent, puis glissez le fichier à partager.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Sélecteur Utilisateur */}
        <div className="space-y-2 relative">
          <label className="text-sm font-medium text-slate-700">Destinataire</label>
          
          {!selectedUser ? (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-300" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom ou email..."
                className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 text-sm"
              />
              {isSearching && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <Loader2 className="h-4 w-4 text-slate-300 animate-spin" />
                </div>
              )}

              {/* Résultats de recherche */}
              {showResults && searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base overflow-auto ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => {
                        setSelectedUser(user);
                        setSearchQuery('');
                        setShowResults(false);
                      }}
                      className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-slate-50 flex items-center gap-3"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${user.role === 'ELEVE' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>
                      <div>
                        <span className="block truncate font-medium text-slate-900">
                          {user.firstName} {user.lastName}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {user.email} • {user.role === 'ELEVE' ? 'Élève' : 'Parent'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${selectedUser.role === 'ELEVE' ? 'bg-blue-500' : 'bg-emerald-500'}`}>
                  {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
                </div>
                <div>
                  <div className="font-medium text-slate-900">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                  <div className="text-xs text-slate-500">{selectedUser.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* 2. Zone Drag & Drop */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Document</label>
          {!file ? (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary-500 bg-primary-50" : "border-slate-300 hover:border-primary-400 hover:bg-slate-50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-2">
                <UploadCloud className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-700">
                  {isDragActive ? "Déposez le fichier ici..." : "Glissez-déposez un fichier ici, ou cliquez pour sélectionner"}
                </p>
                <p className="text-xs text-slate-500">
                  PDF, Word, Excel, Images (Max 10MB)
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded border border-slate-200">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <div className="font-medium text-slate-900 truncate max-w-[200px]">
                    {file.name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* 3. Submit */}
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="submit"
            disabled={!file || !selectedUser || isUploading}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors",
              !file || !selectedUser || isUploading
                ? "bg-slate-300 cursor-not-allowed"
                : "bg-primary-600 hover:bg-primary-700 shadow-sm"
            )}
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Confirmer l'upload
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
