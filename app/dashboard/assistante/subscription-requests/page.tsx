import { redirect } from "next/navigation";

export default async function AssistanteSubscriptionRequestsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams({ tab: "requests" });

  if (params.studentId) qs.set("studentId", params.studentId);

  redirect(`/dashboard/assistante/subscriptions?${qs.toString()}`);
}

