"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AssessmentRunner } from "@/components/assessments/AssessmentRunner";
import { Subject, Grade } from "@/lib/assessments/core/types";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { Loader2 } from "lucide-react";

/**
 * Map bilan-gratuit subject names to Assessment Subject enum.
 * MATHS and NSI get their dedicated assessments.
 * All other subjects (Français, Physique, SVT, etc.) get the GENERAL diagnostic.
 */
function mapSubject(bilanSubject: string): Subject {
  switch (bilanSubject) {
    case "MATHEMATIQUES":
      return Subject.MATHS;
    case "NSI":
      return Subject.NSI;
    case "GENERAL":
    default:
      return Subject.GENERAL;
  }
}

/**
 * Map bilan-gratuit grade to Assessment Grade enum.
 */
function mapGrade(bilanGrade: string): Grade {
  switch (bilanGrade) {
    case "terminale":
      return Grade.TERMINALE;
    case "premiere":
    case "seconde":
    default:
      return Grade.PREMIERE;
  }
}

/**
 * Page: /bilan-gratuit/assessment
 *
 * After bilan-gratuit registration, the student is redirected here
 * with query params: ?subject=MATHEMATIQUES&grade=premiere&name=...&email=...
 *
 * This page hosts the AssessmentRunner which loads QCM questions,
 * lets the student answer, then submits to /api/assessments/submit
 * for scoring + RAG+LLM bilan generation.
 */
function AssessmentContent() {
  const searchParams = useSearchParams();

  const subjectParam = searchParams.get("subject") || "MATHEMATIQUES";
  const gradeParam = searchParams.get("grade") || "premiere";
  const nameParam = searchParams.get("name") || "Élève";
  const emailParam = searchParams.get("email") || "";

  const [ready, setReady] = useState(false);

  const subject = mapSubject(subjectParam);
  const grade = mapGrade(gradeParam);

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
        email: emailParam,
        name: nameParam,
      }}
      apiEndpoint="/api/assessments/submit"
    />
  );
}

export default function BilanAssessmentPage() {
  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <CorporateNavbar />
      <main className="py-8">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-brand-accent" />
            </div>
          }
        >
          <AssessmentContent />
        </Suspense>
      </main>
      <CorporateFooter />
    </div>
  );
}
