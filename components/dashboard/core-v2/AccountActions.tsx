'use client';

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
  const post = (path: string) => v2(`/staff/accounts/${id}/${path}`, { method: 'POST' });

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-400">
        Compte : <span className="text-neutral-200">{STATUS_LABEL[user.accountStatus]}</span>
        {user.activatedAt && <span> · activé le {user.activatedAt.slice(0, 10)}</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {can('ACCOUNT_INVITE') && user.accountStatus === 'PENDING_ACTIVATION' && (
          <>
            <Button type="button" size="sm" disabled={action.pending !== null} onClick={() => void action.run('invite', () => post('invite'), 'Invitation envoyée.')}>
              Inviter
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={action.pending !== null} onClick={() => void action.run('resend', () => post('resend-invitation'), 'Nouvelle invitation envoyée ; l’ancienne est révoquée.')}>
              Renvoyer l’invitation
            </Button>
          </>
        )}
        {can('ACCOUNT_SUSPEND') && user.accountStatus === 'ACTIVE' && (
          <Button type="button" size="sm" variant="outline" disabled={action.pending !== null} onClick={() => void action.run('suspend', () => post('suspend'), 'Compte suspendu ; sessions révoquées.')}>
            Suspendre
          </Button>
        )}
        {can('ACCOUNT_REACTIVATE') && user.accountStatus === 'SUSPENDED' && (
          <Button type="button" size="sm" disabled={action.pending !== null} onClick={() => void action.run('reactivate', () => post('reactivate'), 'Compte réactivé.')}>
            Réactiver
          </Button>
        )}
        {can('ACCOUNT_SUSPEND') && user.accountStatus !== 'DISABLED' && (
          <Button type="button" size="sm" variant="outline" className="border-red-500/40 text-red-200 hover:text-red-100" disabled={action.pending !== null} onClick={() => void action.run('disable', () => post('disable'), 'Compte désactivé définitivement.')}>
            Désactiver
          </Button>
        )}
      </div>
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
