'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { describeFailure, v2, type HouseholdDetail } from './api';
import { useAction } from './actions';
import { StatusMessage } from './StatusMessage';

type ParentMembership = HouseholdDetail['parents'][number];
const MEMBERSHIP_LABELS = { PENDING: 'Rattachement à vérifier', VERIFIED: 'Rattachement vérifié', REVOKED: 'Rattachement révoqué' };

export function HouseholdMembershipActions({ householdId, parent, onChanged }: {
  householdId: string; parent: ParentMembership; onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const revoking = parent.verificationStatus === 'VERIFIED';
  const action = useAction(async () => {
    setOpen(false);
    setEvidence('');
    setConfirmed(false);
    await onChanged();
  }, onChanged);
  const valid = confirmed && (revoking || /^[a-f0-9]{64}$/.test(evidence));
  const evidenceId = `membership-evidence-${parent.id}`;
  const confirmationId = `membership-confirmation-${parent.id}`;

  return (
    <div className="space-y-2">
      <p className="text-sm text-neutral-300">{MEMBERSHIP_LABELS[parent.verificationStatus]}</p>
      <Dialog open={open} onOpenChange={value => { setOpen(value); setConfirmed(false); setEvidence(''); action.clear(); }}>
        <DialogTrigger asChild>
          <Button type="button" size="sm" variant="outline">{revoking ? 'Révoquer le rattachement' : 'Vérifier le rattachement'}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{revoking ? 'Révoquer le rattachement familial' : 'Vérifier le rattachement familial'}</DialogTitle>
            <DialogDescription>
              {revoking ? 'Le parent perdra immédiatement l’accès au foyer et au planning Core-v2. Les parcours historiques V1 nécessitent un contrôle distinct. Ses données et celles des enfants seront conservées.'
                : 'Cette décision ouvre la consultation des enfants de ce foyer. Vérifiez le justificatif administratif avant de confirmer.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={event => {
            event.preventDefault();
            if (!valid) return;
            void action.run('membership', () => v2(`/staff/households/${encodeURIComponent(householdId)}/parents/${encodeURIComponent(parent.id)}/${revoking ? 'revoke' : 'verify'}`, {
              method: 'POST', json: { expectedRevision: parent.membershipRevision, ...(!revoking ? { evidenceDigest: evidence } : {}) },
            }), revoking ? 'Rattachement révoqué.' : 'Rattachement vérifié.');
          }}>
            {!revoking && <div className="space-y-2">
              <Label htmlFor={evidenceId}>Empreinte du justificatif</Label>
              <Input id={evidenceId} value={evidence} onChange={event => setEvidence(event.target.value)} maxLength={64}
                aria-describedby={`${evidenceId}-help`} autoComplete="off" spellCheck={false} />
              <p id={`${evidenceId}-help`} className="text-sm text-neutral-400">Identifiant SHA-256 fourni par la procédure administrative de validation. Ne saisissez ici aucun document ni donnée personnelle.</p>
            </div>}
            <div className="flex items-start gap-2">
              <input id={confirmationId} type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />
              <Label htmlFor={confirmationId}>{revoking ? 'Je confirme la révocation de ce rattachement familial.' : 'Je confirme avoir vérifié le rattachement de ce parent à ce foyer.'}</Label>
            </div>
            {action.failure && <StatusMessage kind="error">{describeFailure(action.failure)}</StatusMessage>}
            <Button type="submit" disabled={!valid || action.pending !== null}>
              {action.pending ? 'Enregistrement…' : revoking ? 'Confirmer la révocation' : 'Confirmer la vérification'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
