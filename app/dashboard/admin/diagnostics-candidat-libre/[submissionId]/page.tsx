import { DiagnosticBilanReview } from '@/components/dashboard/core-v2/DiagnosticBilanReview';

export default async function DiagnosticBilanReviewPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const { submissionId } = await params;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-lg font-semibold text-neutral-100">Bilan — candidat libre</h1>
      <DiagnosticBilanReview submissionId={submissionId} />
    </div>
  );
}
