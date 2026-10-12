/** @jest-environment node */

describe('first administrator CLI invitation delivery', () => {
  const originalArgv = process.argv;
  const originalDisposable = process.env.NEXUS_DISPOSABLE_POSTGRES;
  const admins = jest.fn();
  const bootstrap = jest.fn();
  const invite = jest.fn();
  const resend = jest.fn();
  const deliver = jest.fn();
  const preflight = jest.fn();
  const authorityIsV1 = jest.fn();
  const issued = {
    email: 'synthetic-admin@example.test', rawToken: 'synthetic-private-proof', handoffId: 'handoff-1',
    invitation: { id: 'invitation-1', tokenHash: 'synthetic-proof-digest', expiresAt: new Date('2027-01-01') },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    admins.mockResolvedValue([]);
    bootstrap.mockResolvedValue({ id: 'admin-1' });
    invite.mockResolvedValue(issued);
    resend.mockResolvedValue(issued);
    preflight.mockReset();
    // Par defaut, un deploiement ou Core peut encore detenir les credentials.
    authorityIsV1.mockReturnValue(false);
    process.env.NEXUS_DISPOSABLE_POSTGRES = '1';
    process.argv = ['node', 'bootstrap-admin', '--email=synthetic-admin@example.test', '--first-name=Synthetic', '--last-name=Admin', '--execute'];
    jest.doMock('@/lib/core-v2/client', () => ({
      requireCoreV2Client: async () => ({ user: { findMany: admins } }), disconnectCoreV2Client: async () => undefined,
    }));
    jest.doMock('@/lib/core-v2/services/context', () => ({ createServiceContext: () => ({}) }));
    jest.doMock('@/lib/core-v2/services/account', () => ({ inviteAccount: invite, resendInvitation: resend }));
    jest.doMock('@/lib/core-v2/services/staff-account', () => ({ bootstrapFirstAdmin: bootstrap }));
    jest.doMock('@/lib/auth/parent-activation', () => ({ getTrustedApplicationOrigin: () => new URL('https://example.test') }));
    jest.doMock('@/lib/email/core-v2-invitation', () => ({ deliverCoreV2Invitation: deliver }));
    jest.doMock('@/lib/core-v2/accounts/email-handoff-scheduler', () => ({ assertAccountEmailHandoffRuntimeConfiguration: preflight }));
    // Le script refuse de s'executer sous V1_ONLY : cette dependance doit etre
    // doublee comme les autres, sinon le vrai module se charge et l'import echoue.
    jest.doMock('@/lib/core-v2/accounts/v1-authority', () => ({ credentialAuthorityIsV1: authorityIsV1 }));
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalDisposable === undefined) delete process.env.NEXUS_DISPOSABLE_POSTGRES;
    else process.env.NEXUS_DISPOSABLE_POSTGRES = originalDisposable;
    jest.restoreAllMocks();
  });

  async function run(): Promise<{ code: number; output: string }> {
    const logs = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exited = new Promise<number>((resolve) => {
      jest.spyOn(process, 'exit').mockImplementation(((code: number) => { resolve(code); }) as never);
    });
    await jest.isolateModulesAsync(async () => { await import('../../scripts/core-v2/bootstrap-admin'); });
    const code = await exited;
    return { code, output: JSON.stringify([...logs.mock.calls, ...errors.mock.calls]) };
  }

  test('sous V1_ONLY, l’ancien amorçage refuse et nomme la commande à utiliser', async () => {
    // Core v1 detient les identifiants : ce bootstrap, qui passe par une
    // invitation et une activation Core, ne peut pas aboutir. Il doit echouer
    // ICI, explicitement, et non plus loin sur une erreur de configuration.
    authorityIsV1.mockReturnValue(true);
    const result = await run();
    expect(result.code).toBe(1);
    expect(result.output).toContain('CORE_CREDENTIAL_WRITE_DISABLED_V1_ONLY');
    expect(result.output).toContain('bootstrap-v1-admin');
    // Rien n'a ete tente : ni invitation, ni creation, ni remise.
    expect(invite).not.toHaveBeenCalled();
    expect(bootstrap).not.toHaveBeenCalled();
    expect(deliver).not.toHaveBeenCalled();
  });

  test.each([false, true])('issuance uses only the durable handoff (resend=%s)', async (recovery) => {
    if (recovery) {
      admins.mockResolvedValue([{ id: 'admin-1', accountStatus: 'PENDING_ACTIVATION' }]);
      process.argv.push('--resend-invitation');
    }
    const result = await run();
    expect(result.code).toBe(0);
    expect(recovery ? resend : invite).toHaveBeenCalledTimes(1);
    // Calling the destination here bypasses the durable worker and sends twice.
    expect(deliver).not.toHaveBeenCalled();
    expect(result.output).not.toContain(issued.rawToken);
    expect(result.output).not.toContain(issued.invitation.tokenHash);
  });

  test('rejects a disabled email handoff runtime before creating the first administrator', async () => {
    preflight.mockImplementation(() => { throw new Error('ACCOUNT_EMAIL_CORE_AUTH_DISABLED'); });
    const result = await run();
    expect(result.code).toBe(1);
    expect(bootstrap).not.toHaveBeenCalled();
    expect(invite).not.toHaveBeenCalled();
  });
});
