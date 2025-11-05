"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

interface UploadCopyProps {
  onUpload?: (file: File | null) => void;
  value?: File | null;
}

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function UploadCopy({ onUpload, value }: UploadCopyProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!value) {
      setFileName(null);
      setError(null);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      return;
    }
    setFileName(value.name);
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowed.includes(file.type)) {
      setError("Formats autorisés : PDF, PNG, JPEG");
      setFileName(null);
      onUpload?.(null);
      event.target.value = "";
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Fichier trop volumineux (10 Mo max)");
      setFileName(null);
      onUpload?.(null);
      event.target.value = "";
      return;
    }
    setFileName(file.name);
    setError(null);
    onUpload?.(file);
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
      <label className="flex cursor-pointer flex-col items-center gap-2 text-sm text-slate-600">
        <span className="font-medium text-slate-800">Déposer votre copie</span>
        <span className="text-xs text-slate-500">PDF, PNG ou JPEG · 10&nbsp;Mo max</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/png,image/jpeg"
          className="hidden"
          onChange={handleChange}
        />
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
          Parcourir
        </span>
      </label>
      {fileName ? <p className="mt-3 text-xs text-emerald-600">Fichier sélectionné : {fileName}</p> : null}
      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
