import { beforeAll, vi } from 'vitest';

beforeAll(() => {
  if (!process.env.NODE_ENV) vi.stubEnv('NODE_ENV', 'test');
});
