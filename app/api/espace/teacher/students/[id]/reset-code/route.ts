import { resetStudentCodeByTeacher } from '@/lib/espace/credentials';
import { guarded, json } from '@/lib/espace/http';

export const dynamic = 'force-dynamic';

/**
 * Réinitialise le code personnel d'un élève affecté à l'enseignant. Le code temporaire est renvoyé UNE fois dans
 * cette réponse (jamais relisible ensuite) ; l'élève devra choisir son propre code à la connexion suivante.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return guarded(request, { roles: ['COACH', 'ADMIN'], mutate: true, rate: 'espace-credential-reset' }, async (actor) => {
    const { code } = await resetStudentCodeByTeacher(actor, id);
    return json({ ok: true, temporaryCode: code });
  });
}
