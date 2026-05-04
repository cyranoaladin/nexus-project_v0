// ═══════════════════════════════════════════════════════════════════════════════
// File Upload Zone Component
// Drag-drop interface with progress and validation
// ═══════════════════════════════════════════════════════════════════════════════

'use client';

import { useCallback, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
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
import {
  CORRECTION_DOCUMENT_TYPE_LABELS,
  CORRECTION_DOCUMENT_TYPES,
  type CorrectionDocumentTypeValue,
} from '@/lib/npc/document-types';

interface FileUploadZoneProps {
  submissionId: string;
  maxFiles?: number;
  maxSizeMB?: number;
  existingDocuments?: ExistingDocument[];
}

interface ExistingDocument {
  id: string;
  documentType: string;
  originalFilename: string | null;
  originalFilePath: string;
  mimeType: string | null;
  sizeBytes: number | null;
  status: string;
  createdAt: string;
}

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  documentType: CorrectionDocumentTypeValue;
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
  existingDocuments = [],
}: FileUploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploadedDocuments, setUploadedDocuments] = useState<ExistingDocument[]>(existingDocuments);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Format non supporté: ${file.type}`;
    }
    if (file.size > maxSizeBytes) {
      return `Fichier trop volumineux (max ${maxSizeMB} Mo)`;
    }
    return null;
  }, [maxSizeBytes, maxSizeMB]);

  const addFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;

    setGlobalError(null);
    setSuccessMessage(null);

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
        documentType: 'STUDENT_COPY',
        error: error || undefined,
      };
    });

    setFiles((prev) => [...prev, ...newUploadFiles]);
  }, [files.length, maxFiles, validateFile]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateDocumentType = (id: string, documentType: CorrectionDocumentTypeValue) => {
    setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, documentType } : file)));
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
      formData.append('documentType', uploadFile.documentType);

      const response = await fetch(`/api/npc/submissions/${submissionId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: 'success', progress: 100 } : f
        )
      );

      if (data.document) {
        setUploadedDocuments((prev) => [...prev, data.document]);
      }

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
    setSuccessMessage(null);

    let successCount = 0;

    for (const file of validFiles) {
      const success = await uploadFile(file);
      if (success) successCount++;
    }

    setIsUploading(false);

    if (successCount === validFiles.length) {
      setSuccessMessage(`${successCount} document(s) attaché(s) à la correction`);
      setFiles((prev) => prev.filter((file) => file.status !== 'success'));
    } else {
      setGlobalError(`${validFiles.length - successCount} fichier(s) non uploadé(s)`);
    }
  };

  const handleGenerate = async () => {
    if (!hasStudentCopy) {
      setGlobalError('Ajoutez au moins une copie élève avant de lancer la correction IA.');
      return;
    }

    setIsGenerating(true);
    setGlobalError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/npc/submissions/${submissionId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate correction');
      }

      const data = await response.json();
      setSuccessMessage('Correction IA mise en file d\'attente. Le rapport apparaîtra ici lorsque l\'analyse sera terminée.');

      if (data.reportId) {
        window.location.href = `/dashboard/coach/npc/reports/${data.reportId}`;
      }
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Erreur lors du lancement de la correction');
    } finally {
      setIsGenerating(false);
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
  const hasStudentCopy =
    uploadedDocuments.some((doc) => doc.documentType === 'STUDENT_COPY') ||
    files.some((file) => file.documentType === 'STUDENT_COPY' && file.status !== 'error');
  const hasSubject =
    uploadedDocuments.some((doc) => doc.documentType === 'SUBJECT') ||
    files.some((file) => file.documentType === 'SUBJECT' && file.status !== 'error');
  const hasRubric =
    uploadedDocuments.some((doc) => doc.documentType === 'GRADING_RUBRIC') ||
    files.some((file) => file.documentType === 'GRADING_RUBRIC' && file.status !== 'error');

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
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={(event) => {
              event.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Upload className="h-4 w-4 mr-2" />
            Ajouter des fichiers
          </Button>
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

      {!hasStudentCopy && (
        <Alert variant="destructive">
          <AlertDescription>Au moins une copie élève est obligatoire avant de lancer une correction IA.</AlertDescription>
        </Alert>
      )}

      {(!hasSubject || !hasRubric) && (
        <Alert>
          <AlertDescription>
            Sujet et barème fortement recommandés pour une correction fiable.
          </AlertDescription>
        </Alert>
      )}

      {/* Global Error */}
      {globalError && (
        <Alert variant="destructive">
          <AlertDescription>{globalError}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {uploadedDocuments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-900">
            Documents déjà attachés ({uploadedDocuments.length})
          </h3>
          <div className="space-y-2">
            {uploadedDocuments.map((document) => (
              <Card key={document.id} className="p-3">
                <div className="flex items-center gap-3">
                  {getFileIcon(document.mimeType || '')}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {document.originalFilename || document.originalFilePath}
                    </p>
                    <p className="text-xs text-gray-500">
                      {document.sizeBytes ? ` • ${formatFileSize(document.sizeBytes)}` : ''}
                      {' • '}
                      {document.status}
                    </p>
                    <div className="mt-2 max-w-xs">
                      <Label htmlFor={`existing-document-type-${document.id}`} className="sr-only">
                        Type documentaire
                      </Label>
                      <select
                        id={`existing-document-type-${document.id}`}
                        aria-label="Type documentaire"
                        className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                        value={document.documentType}
                        disabled={isUploading}
                        onChange={async (event) => {
                          const newType = event.target.value as CorrectionDocumentTypeValue;
                          try {
                            const response = await fetch(`/api/npc/submissions/${submissionId}/documents/${document.id}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ documentType: newType }),
                            });
                            if (response.ok) {
                              setUploadedDocuments((prev) =>
                                prev.map((doc) =>
                                  doc.id === document.id ? { ...doc, documentType: newType } : doc
                                )
                              );
                            } else {
                              setGlobalError('Erreur lors de la modification du type');
                            }
                          } catch {
                            setGlobalError('Erreur lors de la modification du type');
                          }
                        }}
                      >
                        {CORRECTION_DOCUMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {CORRECTION_DOCUMENT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              </Card>
            ))}
          </div>
        </div>
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
                <div className="flex items-center gap-3" data-upload-file-row>
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                    <div className="mt-2 max-w-xs">
                      <Label htmlFor={`document-type-${file.id}`} className="sr-only">
                        Type documentaire
                      </Label>
                      <select
                        id={`document-type-${file.id}`}
                        aria-label="Type documentaire"
                        className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                        value={file.documentType}
                        disabled={isUploading || file.status === 'uploading' || file.status === 'success'}
                        onChange={(event) =>
                          updateDocumentType(
                            file.id,
                            event.target.value as CorrectionDocumentTypeValue
                          )
                        }
                      >
                        {CORRECTION_DOCUMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {CORRECTION_DOCUMENT_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>
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

      {/* Generate AI Correction Button */}
      {uploadedDocuments.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                Lancer la correction IA
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {hasStudentCopy && hasSubject && hasRubric
                  ? 'Tous les éléments nécessaires sont attachés.'
                  : hasStudentCopy
                  ? 'Sujet et barème sont fortement recommandés pour une correction fiable.'
                  : 'Ajoutez au moins une copie élève avant de lancer la correction.'}
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!hasStudentCopy || isGenerating || isUploading}
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Lancement en cours...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Lancer la correction IA
                </>
              )}
            </Button>
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
