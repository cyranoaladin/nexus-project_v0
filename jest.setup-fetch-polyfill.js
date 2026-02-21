// This file runs as setupFiles (BEFORE jest-environment-jsdom initializes)
// It captures Node.js native Web API globals before jsdom overwrites them
// These are then restored in jest.setup.js (setupFilesAfterEnv)

const _nativeFetch = globalThis.fetch;
const _nativeRequest = globalThis.Request;
const _nativeResponse = globalThis.Response;
const _nativeHeaders = globalThis.Headers;

// Store on process so they survive environment swap
process.__nodeWebAPIs = {
  fetch: _nativeFetch,
  Request: _nativeRequest,
  Response: _nativeResponse,
  Headers: _nativeHeaders,
};
