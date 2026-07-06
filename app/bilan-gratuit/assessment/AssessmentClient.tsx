"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AssessmentRunner } from "@/components/assessments/AssessmentRunner";
import { Grade, Subject } from "@/lib/assessments/core/types";

interface AssessmentClientProps {
  subject: Subject;
  grade: Grade;
  name: string;
  email: string;
  assessmentPublicToken: string;
}

export function AssessmentClient({
  subject,
  grade,
  name,
  email,
  assessmentPublicToken,
}: AssessmentClientProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-brand-accent mx-auto" />
          <p className="text-lg text-neutral-400">Chargement de l&apos;évaluation...</p>
        </div>
      </div>
    );
  }

  return (
    <AssessmentRunner
      subject={subject}
      grade={grade}
      studentData={{
        email,
        name,
      }}
      apiEndpoint="/api/assessments/submit"
      assessmentPublicToken={assessmentPublicToken}
    />
  );
}
