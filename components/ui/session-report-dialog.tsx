"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SessionReportForm } from "@/components/ui/session-report-form";

interface SessionReportDialogProps {
  sessionId: string;
  onReportSubmitted?: () => void;
  trigger: React.ReactNode;
}

export function SessionReportDialog({
  sessionId,
  onReportSubmitted,
  trigger,
}: SessionReportDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSuccess = () => {
    setOpen(false);
    if (onReportSubmitted) {
      onReportSubmitted();
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compte-rendu de session</DialogTitle>
          <DialogDescription>
            Remplissez le formulaire ci-dessous pour soumettre le rapport de session. 
            Le parent sera automatiquement notifié par email.
          </DialogDescription>
        </DialogHeader>
        <SessionReportForm
          sessionId={sessionId}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
