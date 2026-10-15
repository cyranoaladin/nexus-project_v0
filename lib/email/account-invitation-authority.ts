/** Dependency inversion: the V1 mailer never imports Core or trusts client scope. */
export interface AccountInvitationReference { readonly userId: string; readonly generation: number; }
export interface AccountInvitationDeliveryAuthority {
  readonly userId: string; readonly generation: number; readonly issuerId: string; readonly issuerVersion: number;
  readonly databaseIdentity: string; readonly bindingDigest: string; readonly recipientDigest: string;
  readonly operation: 'INVITE' | 'RESEND';
}
export class InvitationDeliveryRefusal extends Error {
  constructor() { super('INVITATION_DELIVERY_REFUSED'); }
}
export type AccountInvitationAuthority = <T>(reference: AccountInvitationReference,
  deliver: (authority: AccountInvitationDeliveryAuthority) => Promise<T>) => Promise<T>;
const state = globalThis as typeof globalThis & { __accountInvitationAuthority?: AccountInvitationAuthority };
export function registerAccountInvitationAuthority(authority: AccountInvitationAuthority): void {
  state.__accountInvitationAuthority = authority;
}
export function resolveAccountInvitationAuthority(): AccountInvitationAuthority {
  if (!state.__accountInvitationAuthority) throw new Error('INVITATION_DELIVERY_AUTHORITY_UNAVAILABLE');
  return state.__accountInvitationAuthority;
}
