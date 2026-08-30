import { StaffStudentsPage } from '@/components/dashboard/staff/StaffStudentsPage';

interface Props {
  searchParams?: Promise<{ intent?: string | string[] }>;
}

export default async function AssistanteStudentsPage({ searchParams = Promise.resolve({}) }: Props) {
  const { intent } = await searchParams;
  return StaffStudentsPage({ staffRole: 'ASSISTANTE', intent });
}
