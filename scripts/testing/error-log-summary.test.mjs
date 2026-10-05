import assert from 'node:assert/strict';
import { test } from 'node:test';
import cjs from '../serialize-error.cjs';
import { serializeError as esm } from '../serialize-error.mjs';

for (const [format, serializeError] of [['CommonJS', cjs.serializeError], ['ESM', esm]]) {
  test(`${format} refuses all free text and circular causes`, () => {
    const error = new Error('synthetic-private-diagnostic');
    error.cause = error;
    error.stack = 'synthetic-private-diagnostic';
    assert.deepEqual(serializeError(error), { name: 'Error', message: 'Operation failed' });
    for (const value of ['synthetic-private-diagnostic', 123456, { private: 'synthetic-private-diagnostic' }]) {
      assert.deepEqual(serializeError(value), { name: 'UnknownError', message: 'Operation failed' });
    }
  });
  test(`${format} never calls arbitrary serialization hooks`, () => {
    const error = { toJSON() { throw new Error('unexpected serialization'); }, toString() { throw new Error('unexpected conversion'); } };
    assert.deepEqual(serializeError(error), { name: 'UnknownError', message: 'Operation failed' });
    const proxy = new Proxy({}, { getPrototypeOf() { throw new Error('inspection failed'); } });
    assert.deepEqual(serializeError(proxy), { name: 'UnknownError', message: 'Operation failed' });
  });
  test(`${format} retains only a bounded database code`, () => {
    const error = new Error('synthetic-private-diagnostic');
    error.code = 'P2002';
    assert.deepEqual(serializeError(error), { name: 'Error', message: 'Operation failed', code: 'P2002' });
    error.code = 'synthetic-private-diagnostic';
    assert.deepEqual(serializeError(error), { name: 'Error', message: 'Operation failed' });
  });
}
