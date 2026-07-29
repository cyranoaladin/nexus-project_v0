var transport = {
  sendMail: jest.fn(),
};

jest.mock('nodemailer9', () => {
  const localTransport = { sendMail: jest.fn() };
  (globalThis as any).__emailTransport = localTransport;
  return {
    __esModule: true,
    default: {
      createTransport: jest.fn(() => localTransport),
    },
  };
});

import {
  sendCreditExpirationReminder,
  sendExistingAccountBilanEmail,
  sendWelcomeParentEmail,
} from '@/lib/email';

describe('email', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    transport = (globalThis as any).__emailTransport || transport;
    transport.sendMail.mockReset();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends welcome parent email', async () => {
    (process.env as any).NODE_ENV = 'production';
    await sendWelcomeParentEmail('parent@test.com', 'Parent', 'Student', 'https://nexusreussite.academy/auth/activate?token=abc');
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  it('handles send error in development without throwing', async () => {
    (process.env as any).NODE_ENV = 'development';
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    transport.sendMail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      sendWelcomeParentEmail('parent@test.com', 'Parent', 'Student')
    ).resolves.toBeUndefined();
    errSpy.mockRestore();
  });

  it('throws send error in production', async () => {
    (process.env as any).NODE_ENV = 'production';
    transport.sendMail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      sendCreditExpirationReminder('parent@test.com', 'Parent', 'Student', 2, new Date())
    ).rejects.toThrow('smtp down');
  });

  it('escapes hostile parent names in the existing-account continuation email', async () => {
    (process.env as any).NODE_ENV = 'production';
    await sendExistingAccountBilanEmail(
      'parent@test.com',
      '<img src=x onerror="alert(1)"> & Parent',
    );

    const html = transport.sendMail.mock.calls[0][0].html as string;
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; Parent');
    expect(html).not.toContain('<img src=x');
  });

  it('does not promise sign-in before the secure continuation flow exists', async () => {
    (process.env as any).NODE_ENV = 'production';
    await sendExistingAccountBilanEmail('parent@test.com', 'Parent');

    const html = transport.sendMail.mock.calls[0][0].html as string;
    expect(html).not.toContain('/auth/signin');
    expect(html).not.toContain('Accéder à mon espace');
    expect(html).not.toContain('poursuivre depuis votre espace');
    expect(html).toContain('Notre équipe pédagogique va l’examiner et vous recontacter.');
  });
});
