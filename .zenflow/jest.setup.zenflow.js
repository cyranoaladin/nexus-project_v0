global.setImmediate = global.setImmediate || ((fn, ...args) => global.setTimeout(fn, 0, ...args));

jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234-5678-90ab-cdef',
}));
