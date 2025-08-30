import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
});


