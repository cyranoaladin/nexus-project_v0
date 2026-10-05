import { serializeError } from '@/lib/utils/serialize-error';

const privateMarker = 'synthetic-private-diagnostic';

describe('serializeError privacy boundary', () => {
  it('keeps only bounded operational metadata from an Error', () => {
    const error = new Error(privateMarker);
    error.stack = privateMarker;
    const serialized = serializeError(error);
    expect(serialized).toEqual({ name: 'Error', message: 'Operation failed' });
    expect(JSON.stringify(serialized)).not.toContain(privateMarker);
  });

  it.each([privateMarker, 123456, null, { private: privateMarker }, [privateMarker]])('never emits arbitrary thrown values %#', value => {
    expect(serializeError(value)).toEqual({ name: 'UnknownError', message: 'Operation failed' });
  });

  it('does not traverse a circular cause or retain a custom name', () => {
    const error = new Error(privateMarker, { cause: null });
    error.name = privateMarker;
    error.cause = error;
    expect(serializeError(error)).toEqual({ name: 'Error', message: 'Operation failed' });
  });

  it('does not invoke arbitrary serialization hooks or getters', () => {
    const toJSON = jest.fn(() => privateMarker);
    const toString = jest.fn(() => privateMarker);
    const message = jest.fn(() => privateMarker);
    const error = { toJSON, toString, get message() { return message(); } };
    expect(serializeError(error)).toEqual({ name: 'UnknownError', message: 'Operation failed' });
    expect(toJSON).not.toHaveBeenCalled();
    expect(toString).not.toHaveBeenCalled();
    expect(message).not.toHaveBeenCalled();
  });

  it('does not invoke Error metadata getters', () => {
    const error = new Error(privateMarker);
    const name = jest.fn(() => privateMarker);
    const code = jest.fn(() => privateMarker);
    Object.defineProperties(error, { name: { get: name }, code: { get: code } });
    expect(serializeError(error)).toEqual({ name: 'Error', message: 'Operation failed' });
    expect(name).not.toHaveBeenCalled();
    expect(code).not.toHaveBeenCalled();
  });

  it('retains allowlisted database codes but never arbitrary code values', () => {
    const error = new Error(privateMarker);
    Object.defineProperty(error, 'code', { value: 'P2002', configurable: true });
    expect(serializeError(error)).toEqual({ name: 'Error', message: 'Operation failed', code: 'P2002' });
    Object.defineProperty(error, 'code', { value: privateMarker });
    expect(serializeError(error)).toEqual({ name: 'Error', message: 'Operation failed' });
  });
});
