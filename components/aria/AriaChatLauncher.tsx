'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AriaChatPanel } from './AriaChatPanel';

export function AriaChatLauncher({
  initialCourseKey,
  open: controlledOpen,
  onOpen,
  onClose,
}: Readonly<{
  initialCourseKey?: string;
  open?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}>) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const openPanel = () => onOpen ? onOpen() : setInternalOpen(true);
  const closePanel = () => onClose ? onClose() : setInternalOpen(false);
  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        data-testid="aria-chat-trigger"
        aria-label="Ouvrir ARIA"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-surface-darker shadow-lg hover:bg-brand-accent/90"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
      </button>
      <AriaChatPanel open={open} onClose={closePanel} initialCourseKey={initialCourseKey} />
    </>
  );
}
