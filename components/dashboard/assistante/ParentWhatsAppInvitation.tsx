'use client';
import { useEffect, useRef, useState } from 'react';

type Props = { parentUserId: string; accountActivated?: boolean };
type Invitation = { whatsappUrl: string; expiresAt: string; purpose: 'ACTIVATION' | 'RECOVERY' };
export function ParentWhatsAppInvitation(props: Props) {
  return <InvitationForParent key={props.parentUserId} {...props} />;
}
function InvitationForParent({ parentUserId, accountActivated = false }: Props) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [state, setState] = useState<'idle' | 'preparing' | 'ready' | 'expired' | 'error'>('idle');
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => {
    if (!invitation) return;
    const timer = setTimeout(() => { setInvitation(null); setState('expired'); }, Math.max(0, Date.parse(invitation.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [invitation]);
  async function prepare() {
    if (state === 'preparing') return;
    setInvitation(null); setState('preparing');
    try {
      const response = await fetch(`/api/assistante/parents/${encodeURIComponent(parentUserId)}/whatsapp-invitation`, { method: 'POST', cache: 'no-store' });
      if (!response.ok) throw new Error('PREPARATION_FAILED');
      const data = await response.json() as Invitation;
      const url = new URL(data.whatsappUrl);
      const remaining = Date.parse(data.expiresAt) - Date.now();
      if (url.protocol !== 'https:' || url.hostname !== 'wa.me' || !/^\/\d+$/.test(url.pathname)
        || !Number.isFinite(remaining) || remaining <= 0 || remaining > 2147483647
        || !['ACTIVATION', 'RECOVERY'].includes(data.purpose)) throw new Error('INVALID_INVITATION');
      if (!live.current) return;
      setInvitation(data); setState('ready');
    } catch { if (live.current) setState('error'); }
  }
  return <section className="space-y-3 rounded-xl border border-white/15 p-4 text-sm text-slate-200" aria-label="Invitation WhatsApp manuelle">
    <p>L’envoi est manuel : ouvrez WhatsApp, vérifiez le destinataire, puis appuyez sur « Envoyer » dans l’application.</p>
    <button type="button" disabled={state === 'preparing'} onClick={() => void prepare()} className="rounded-lg border border-amber-300/50 px-3 py-2 text-amber-200 disabled:opacity-50">
      {state === 'preparing' ? 'Préparation…' : state === 'ready' || state === 'expired' ? 'Renouveler l’invitation WhatsApp' : accountActivated ? 'Préparer un lien de récupération WhatsApp' : 'Préparer l’invitation WhatsApp'}
    </button>
    {state === 'error' && <p role="alert" className="text-amber-200">Impossible de préparer le lien. Vérifiez le dossier du parent puis réessayez.</p>}
    {state === 'expired' && <p role="status">Lien expiré. Préparez une nouvelle invitation avant de l’envoyer.</p>}
    {invitation && <div className="space-y-2">
      <p role="status">Lien {invitation.purpose === 'RECOVERY' ? 'de récupération' : 'd’activation'} prêt. Aucun envoi automatique n’a été effectué.</p>
      <p>Valable jusqu’au <time dateTime={invitation.expiresAt}>{new Date(invitation.expiresAt).toLocaleString('fr-FR')}</time>. Un renouvellement invalide le lien précédent.</p>
      <a href={invitation.whatsappUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block rounded-lg bg-emerald-800 px-3 py-2 font-medium text-white">Envoyer l’invitation sur WhatsApp</a>
      <p className="text-xs text-slate-300">L’ouverture de WhatsApp ne confirme ni l’envoi ni la réception.</p>
    </div>}
  </section>;
}
