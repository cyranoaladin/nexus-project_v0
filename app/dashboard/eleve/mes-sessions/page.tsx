import { redirect } from 'next/navigation';

export default function MesSessionsRedirectPage() {
  redirect('/dashboard/eleve#sessions');
}
