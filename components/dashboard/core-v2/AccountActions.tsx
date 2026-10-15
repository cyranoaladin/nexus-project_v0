'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { type PublicUser, describeFailure, v2 } from './api';
import { isStaleConflict, useAction } from './actions';
import { StatusMessage } from './StatusMessage';

const STATUS_LABEL: Record<PublicUser['accountStatus'], string> = {
  PENDING_ACTIVATION: 'À activer',
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
  DISABLED: 'Désactivé',
};

/** Invitation and lifecycle controls for one account, gated by the actor's capabilities. */
export function AccountActions({ user, can, onChanged }: { user: PublicUser; can: (c: string) => boolean; onChanged: () => Promise<void> }) {
  const action = useAction(onChanged);
  const id = user.id;
  const resendCommand = useRef<{ userId: string; id: string } | null>(null);
  const resend = async () => {
    if (resendCommand.current?.userId !== id) resendCommand.current = { userId: id, id: crypto.randomUUID() };
    const result = await v2(`/staff/accounts/${id}/resend-invitation`, { method: 'POST', commandId: resendCommand.current.id });
    // Retain identity on an unknown network/server outcome, including lost JSON.
    if (result.ok || (result.status >= 400 && result.status < 500)) resendCommand.current = null;
    return result;
  };
  const post = (path: string) => v2(`/staff/accounts/${id}/${path}`, { method: 'POST' });

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-400">
        Compte : <span className="text-neutral-200">{STATUS_LABEL[user.accountStatus]}</span>
        {user.activatedAt && <span> · activé le {user.activatedAt.slice(0, 10)}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {can('ACCOUNT_INVITE') && user.role !== 'ADMIN' && user.accountStatus === 'PENDING_ACTIVATION'
          && (user.role === 'PARENT' || user.role === 'ELEVE' || can('STAFF_ACCOUNT_CREATE')) && (
          <>
            <Button type="button" size="sm" disabled={action.pending !== null} onClick={() => void action.run('invite', () => post('invite'), 'Invitation mise en file d’envoi.')}>
              Inviter
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={action.pending !== null} onClick={() => void action.run('resend', resend, 'Nouvelle invitation mise en file d’envoi ; l’ancienne est révoquée.')}>
              Renvoyer l’invitation
            </Button>
          </>
        )}
        {/*
          Ces actions ne portent QUE sur l'accès Core v2. Elles ne touchent ni le
          mot de passe, ni l'activation, ni les sessions, ni l'accès V1 : dire
          « compte suspendu » ou « compte désactivé » ferait croire à une
          suspension globale, qui est une action V1 distincte et plus fortement
          autorisée. Les libellés le disent explicitement.
        */}
        {can('ACCOUNT_SUSPEND') && user.accountStatus === 'ACTIVE' && (
          <Button type="button" size="sm" variant="outline" disabled={action.pending !== null} onClick={() => void action.run('suspend', () => post('suspend'), 'Accès Core v2 suspendu ; sessions Core révoquées. L’accès V1 n’est pas modifié.')}>
            Suspendre l’accès Core v2
          </Button>
        )}
        {can('ACCOUNT_REACTIVATE') && user.accountStatus === 'SUSPENDED' && (
          <Button type="button" size="sm" disabled={action.pending !== null} onClick={() => void action.run('reactivate', () => post('reactivate'), 'Accès Core v2 rétabli. Aucune réactivation V1 n’a lieu.')}>
            Rétablir l’accès Core v2
          </Button>
        )}
        {can('ACCOUNT_SUSPEND') && user.accountStatus !== 'DISABLED' && (
          <Button type="button" size="sm" variant="outline" className="border-red-500/40 text-red-200 hover:text-red-100" disabled={action.pending !== null} onClick={() => void action.run('disable', () => post('disable'), 'Accès Core v2 retiré définitivement. Le compte V1 n’est ni suspendu ni supprimé.')}>
            Retirer l’accès Core v2
          </Button>
        )}
      </div>
      {can('ACCOUNT_INVITE') && (user.role === 'PARENT' || user.role === 'ELEVE')
        && user.accountStatus === 'PENDING_ACTIVATION' && (
          <p className="text-xs text-neutral-400">L’invitation nécessite un foyer vérifié, une inscription annuelle active et, pour l’assistante, une affectation à ce foyer et à cette année scolaire.</p>
        )}
      {action.failure && (
        <StatusMessage kind="error">
          {describeFailure(action.failure)}
          {isStaleConflict(action.failure) && ' — la fiche a été rechargée.'}
        </StatusMessage>
      )}
      {action.success && <StatusMessage kind="success">{action.success}</StatusMessage>}
    </div>
  );
}
