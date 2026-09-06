import { redirect } from 'next/navigation';

export default function LegacyFinanceRedirect() {
  redirect('/dashboard/assistante/paiements');
}
