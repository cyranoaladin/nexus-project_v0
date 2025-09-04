import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import nextDynamic from 'next/dynamic';

const Client = nextDynamic(() => import('./widget'), { ssr: false });

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  const allowed = role === 'ADMIN' || role === 'ASSISTANTE' || role === 'COACH';
  if (!allowed) return <div className="p-6">Accès non autorisé</div> as any;
  return <Client /> as any;
}
