import jwt from 'jsonwebtoken';

describe('Security - JWT role escalation tampering', () => {
  it('rejects token with modified role payload and original signature', () => {
    const secret = 'e2e-jwt-secret';

    const validToken = jwt.sign({ id: 'user-eleve', role: 'ELEVE' }, secret, { expiresIn: '1h' });
    const [header, payload, signature] = validToken.split('.');

    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...decodedPayload, role: 'ADMIN' }),
      'utf8'
    ).toString('base64url');

    const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

    expect(() => jwt.verify(tamperedToken, secret)).toThrow();
  });
});
