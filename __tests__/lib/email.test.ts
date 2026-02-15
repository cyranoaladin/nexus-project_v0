var transport = {
  sendMail: jest.fn(),
};

jest.mock('nodemailer', () => {
  const localTransport = { sendMail: jest.fn() };
  (globalThis as any).__emailTransport = localTransport;
  return {
    __esModule: true,
    default: {
      createTransport: jest.fn(() => localTransport),
    },
  };
});

import { sendCreditExpirationReminder, sendWelcomeParentEmail } from '@/lib/email';

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
    process.env.NODE_ENV = 'production';
    await sendWelcomeParentEmail('parent@test.com', 'Parent', 'Student', 'temp123');
    expect(transport.sendMail).toHaveBeenCalledTimes(1);
  });

  it('handles send error in development without throwing', async () => {
    process.env.NODE_ENV = 'development';
    transport.sendMail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      sendWelcomeParentEmail('parent@test.com', 'Parent', 'Student')
    ).resolves.toBeUndefined();
  });

  it('throws send error in production', async () => {
    process.env.NODE_ENV = 'production';
    transport.sendMail.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      sendCreditExpirationReminder('parent@test.com', 'Parent', 'Student', 2, new Date())
    ).rejects.toThrow('smtp down');
  });
});
