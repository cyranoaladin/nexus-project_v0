/* eslint-disable no-var */
var mockTransportSendMail = jest.fn();
/* eslint-enable no-var */

jest.mock('nodemailer9', () => {
  mockTransportSendMail = jest.fn();
  return {
    __esModule: true,
    default: {
      createTransport: jest.fn(() => ({
        sendMail: mockTransportSendMail,
        verify: jest.fn().mockResolvedValue(true),
      })),
    },
  };
});

import { resetTransporter, sendMail } from '@/lib/email/mailer';

const originalEnv = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  resetTransporter();
  process.env = { ...originalEnv, MAIL_DISABLED: 'false' };
  (process.env as NodeJS.ProcessEnv & { NODE_ENV: string }).NODE_ENV = 'test';
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_PORT = '587';
});

afterAll(() => {
  process.env = originalEnv;
});

describe.each([
  ['SMTP timeout', 'ETIMEDOUT'],
  ['SMTP connection interruption', 'ECONNRESET'],
  ['SMTP recipient refusal', 'EENVELOPE'],
])('%s', (_label, code) => {
  it('fails closed without logging message contents', async () => {
    const privateDetail = `PRIVATE_SMTP_DETAIL_${code}`;
    const smtpError = Object.assign(new Error(privateDetail), { code });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockTransportSendMail.mockRejectedValueOnce(smtpError);

    await expect(sendMail({
      to: 'synthetic-parent@example.test',
      subject: 'Activation de test',
      text: privateDetail,
      html: `<p>${privateDetail}</p>`,
    })).rejects.toBe(smtpError);

    const serializedLogs = JSON.stringify(errorSpy.mock.calls);
    expect(serializedLogs).toContain(code);
    expect(serializedLogs).not.toContain(privateDetail);

    errorSpy.mockRestore();
  });
});
