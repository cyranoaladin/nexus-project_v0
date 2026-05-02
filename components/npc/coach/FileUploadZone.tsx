// ═══════════════════════════════════════════════════════════════════════════════
// File Upload Zone Component
// Drag-drop interface with progress and validation
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  File,
  X,
  FileText,
  Image as ImageIcon,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  submissionId: string;
  maxFiles?: number;
  maxSizeMB?: number;
}

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

export function FileUploadZone({
  submissionId,
  maxFiles = 10,
  maxSizeMB = 20,
}: FileUploadZoneProps) {
  const router = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Format non supporté: ${file.type}`;
    }
    if (file.size > maxSizeBytes) {
      return `Fichier trop volumineux (max ${maxSizeMB} Mo)`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    setGlobalError(null);

    const filesArray = Array.from(newFiles);

    if (files.length + filesArray.length > maxFiles) {
      setGlobalError(`Maximum ${maxFiles} fichiers autorisés`);
      return;
    }

    const newUploadFiles: UploadFile[] = filesArray.map((file) => {
      const error = validateFile(file);
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        progress: 0,
        status: error ? 'error' : 'pending',
        error: error || undefined,
      };
    });

    setFiles((prev) => [...prev, ...newUploadFiles]);
  }, [files.length, maxFiles, maxSizeBytes, maxSizeMB]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    // Reset input to allow re-selecting same files
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const uploadFile = async (uploadFile: UploadFile): Promise<boolean> => {
    if (uploadFile.status === 'error') return false;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
      )
    );

    try {
      const formData = new FormData();
      formData.append('file', uploadFile.file);
      formData.append('submissionId', submissionId);
      formData.append('pageNumber', '1'); // Will be set server-side
      formData.append('description', `Page from ${uploadFile.name}`);

      const response = await fetch('/api/npc/uploads', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      // Simulate progress (actual progress tracking would need XHR)
      for (let i = 0; i <= 100; i += 20) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadFile.id ? { ...f, progress: i } : f
          )
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
        )
      );

      return true;
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? {
                ...f,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : f
        )
      );
      return false;
    }
  };

  const handleUpload = async () => {
    const validFiles = files.filter((f) => f.status !== 'error');

    if (validFiles.length === 0) {
      setGlobalError('Aucun fichier valide à uploader');
      return;
    }

    setIsUploading(true);
    setGlobalError(null);

    let successCount = 0;

    for (const file of validFiles) {
      const success = await uploadFile(file);
      if (success) successCount++;
    }

    setIsUploading(false);

    if (successCount === validFiles.length) {
      // All files uploaded successfully
      setTimeout(() => {
        router.push(`/dashboard/coach/npc/submissions/${submissionId}`);
      }, 1000);
    } else {
      setGlobalError(`${validFiles.length - successCount} fichier(s) non uploadé(s)`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const getFileIcon = (type: string) => {
    if (type === 'application/pdf') return <FileText className="h-5 w-5 text-red-500" />;
    if (type.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const errorCount = files.filter((f) => f.status === 'error').length;
  const canUpload = pendingCount > 0 && !isUploading;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={cn(
          'border-2 border-dashed transition-colors cursor-pointer',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Upload className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900">
            Glissez-déposez vos fichiers ici
          </p>
          <p className="text-sm text-gray-500 mt-1">
            ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-gray-400 mt-2">
            PDF, JPEG, PNG, WEBP • Max {maxSizeMB} Mo • Max {maxFiles} fichiers
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(',')}
            className="hidden"
            onChange={handleFileInput}
          />
        </CardContent>
      </Card>

      {/* Global Error */}
      {globalError && (
        <Alert variant="destructive">
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">
            Fichiers ({files.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <Card
                key={file.id}
                className={cn(
                  'p-3',
                  file.status === 'error' && 'border-red-300 bg-red-50',
                  file.status === 'success' && 'border-green-300 bg-green-50'
                )}
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                    {file.status === 'uploading' && (
                      <Progress value={file.progress} className="h-1 mt-2" />
                    )}
                    {file.error && (
                      <p className="text-xs text-red-600 mt-1">{file.error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === 'success' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                    {file.status !== 'uploading' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.id);
                        }}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    {file.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-gray-600">
            {pendingCount > 0 && (
              <span>{pendingCount} fichier(s) prêt(s)</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-600 ml-2">
                ({errorCount} erreur(s))
              </span>
            )}
          </div>
          <Button
            onClick={handleUpload}
            disabled={!canUpload}
            size="lg"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Upload en cours...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Uploader {pendingCount > 0 && `(${pendingCount})`}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
