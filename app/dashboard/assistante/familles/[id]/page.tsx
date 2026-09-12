import { HouseholdDetail } from '@/components/dashboard/core-v2/HouseholdDetail';

export default async function FamillePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HouseholdDetail householdId={id} basePath="/dashboard/assistante/familles" />;
}
