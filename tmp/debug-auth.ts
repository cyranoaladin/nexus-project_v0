import CredentialsProvider from 'next-auth/providers/credentials';

import { authOptions } from '../lib/auth';

(async () => {
  const provider = authOptions.providers.find((p: any) => p.id === 'credentials');
  if (!provider) {
    console.error('Credentials provider not found');
    process.exit(1);
  }

  const authorize = (provider as ReturnType<typeof CredentialsProvider> & { authorize?: (credentials: any) => Promise<any> }).authorize;
  if (!authorize) {
    console.error('Credentials provider missing authorize implementation');
    process.exit(1);
  }

  const user = await authorize({ email: 'student@test.local', password: 'password' });
  console.log('authorize returned', user);

  if (!user) {
    return;
  }

  const jwtCb = authOptions.callbacks?.jwt;
  const sessionCb = authOptions.callbacks?.session;

  if (!jwtCb || !sessionCb) {
    console.error('Missing callbacks');
    return;
  }

  let token = await jwtCb({ token: { sub: user.id }, user } as any);
  console.log('jwt callback result', token);

  token = await jwtCb({ token } as any);
  console.log('jwt callback (no user) result', token);

  const session = await sessionCb({ session: { user: { email: user.email, id: '' } } as any, token } as any);
  console.log('session callback result', session);
})();
