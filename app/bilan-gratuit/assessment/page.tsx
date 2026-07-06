import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AssessmentClient } from "./AssessmentClient";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import {
  ASSESSMENT_FLOW_COOKIE_NAME,
  buildAssessmentAliasEmail,
  createAssessmentPublicToken,
  verifyAssessmentFlowToken,
} from "@/lib/assessments/public-token";
import { Grade } from "@/lib/assessments/core/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function AssessmentAccessUnavailable() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-lg border border-white/10 bg-white/5 p-8">
        <h1 className="text-3xl font-semibold text-white">Accès au diagnostic expiré</h1>
        <p className="mt-4 text-sm text-neutral-300">
          Pour accéder au diagnostic, commencez par envoyer la demande de bilan gratuit.
          Notre équipe pourra ensuite exploiter les réponses dans le bon contexte pédagogique.
        </p>
      </div>
    </div>
  );
}

/**
 * Page: /bilan-gratuit/assessment
 *
 * The assessment submission API requires a short-lived signed token bound to a
 * lead/session flow. This page never issues a token from public query params.
 */
export default async function BilanAssessmentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  if (Object.keys(resolvedSearchParams).length > 0) {
    redirect("/bilan-gratuit/assessment");
  }

  const cookieStore = await cookies();
  const flowCookie = cookieStore.get(ASSESSMENT_FLOW_COOKIE_NAME)?.value;
  const flowVerification = verifyAssessmentFlowToken(flowCookie, {
    source: "bilan-gratuit",
  });

  if (!flowVerification.valid) {
    return (
      <div className="min-h-screen bg-surface-darker text-neutral-100">
        <CorporateNavbar />
        <main id="main-content" className="py-8">
          <AssessmentAccessUnavailable />
        </main>
        <CorporateFooter />
      </div>
    );
  }

  const { subject, grade, leadEmailHash, source } = flowVerification.payload;
  const assessmentPublicToken = createAssessmentPublicToken({
    subject,
    grade,
    source,
    binding: "lead",
    leadEmailHash,
  });
  const email = buildAssessmentAliasEmail(leadEmailHash);

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      <CorporateNavbar />
      <main id="main-content" className="py-8">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-brand-accent" />
            </div>
          }
        >
          <AssessmentClient
            subject={subject}
            grade={grade as Grade}
            name="Élève Nexus"
            email={email}
            assessmentPublicToken={assessmentPublicToken}
          />
        </Suspense>
      </main>
      <CorporateFooter />
    </div>
  );
}
