import { classifySmtpFailure, classifyInvitationSmtpFailure } from '@/lib/email/outbox-worker';

describe('SMTP outbox failure classification', () => {
  test('classifies post-DATA timeout and reset as ambiguous', () => {
    expect(classifySmtpFailure(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', command: 'DATA' }), 1).status).toBe('AMBIGUOUS');
    expect(classifySmtpFailure(Object.assign(new Error('connection lost'), { code: 'ECONNECTION' }), 1).status).toBe('AMBIGUOUS');
    expect(classifySmtpFailure(Object.assign(new Error('reset'), { code: 'ECONNRESET' }), 1).status).toBe('AMBIGUOUS');
  });

  test('retries temporary failures and terminates permanent rejection', () => {
    expect(classifySmtpFailure(Object.assign(new Error('temporary'), { code: 'EENVELOPE', responseCode: 450 }), 1).status).toBe('RETRY_SCHEDULED');
    expect(classifySmtpFailure(Object.assign(new Error('permanent'), { code: 'EENVELOPE', responseCode: 550 }), 1).status).toBe('FAILED_FINAL');
  });

  test('bounds retries', () => {
    process.env.EMAIL_OUTBOX_MAX_ATTEMPTS = '3';
    expect(classifySmtpFailure(Object.assign(new Error('down'), { code: 'ECONNECTION' }), 3).status).toBe('FAILED_FINAL');
    delete process.env.EMAIL_OUTBOX_MAX_ATTEMPTS;
  });
  test.each([undefined, new Error('database acknowledgement lost'), { code: 'ECONNRESET', command: 'DATA' },
    { code: 'ESOCKET' }, { code: 'P2028' }])('invitation handoff uncertainty never becomes an automatic retry', error => {
    expect(classifyInvitationSmtpFailure(error, 20)).toEqual({ status: 'AMBIGUOUS', code: 'INVITATION_DELIVERY_UNCERTAIN' });
  });
  test('only explicit pre-DATA protocol rejections authorize an invitation retry', () => {
    expect(classifyInvitationSmtpFailure({ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 450 }, 1).status).toBe('RETRY_SCHEDULED');
    expect(classifyInvitationSmtpFailure({ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 }, 1).status).toBe('FAILED_FINAL');
    expect(classifyInvitationSmtpFailure({ code: 'ESOCKET', command: 'CONN', responseCode: 421 }, 1).status).toBe('RETRY_SCHEDULED');
  });
});
