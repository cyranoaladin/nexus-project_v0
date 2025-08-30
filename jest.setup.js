// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Prisma client
jest.mock('./lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    parentProfile: {
      create: jest.fn(),
    },
    studentProfile: {
      create: jest.fn(),
    },
    session: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    creditTransaction: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    coachProfile: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock Next Auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock environment variables
try {
  const { randomUUID } = require('crypto');
  if (!process.env.NEXTAUTH_SECRET) process.env.NEXTAUTH_SECRET = randomUUID();
} catch {}
process.env.NODE_ENV = 'test';
// Ensure E2E flags are off for unit tests so RAG ingest is not skipped
delete process.env.NEXT_PUBLIC_E2E;
delete process.env.E2E;
delete process.env.E2E_RUN;
// Align RAG URL with tests that expect internal hostname
process.env.RAG_SERVICE_URL = 'http://rag_service:8001';

// Intercept network calls to internal services to keep tests quiet and deterministic
(() => {
  const origFetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined;
  if (typeof origFetch === 'function') {
    globalThis.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) ? input.url : String(input);
      // PDF generator
      if (url.includes('http://localhost:8002/generate')) {
        const body = JSON.stringify({ message: 'ok', url: '/generated/mock.pdf' });
        return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // RAG ingest
      if (url.includes('http://rag_service:8001/ingest')) {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // LLM chat
      if (url.includes('http://localhost:8003/chat')) {
        return new Response(
          JSON.stringify({ response: 'Réponse mockée ARIA', contenu_latex: '\\textbf{Mock}', mock: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return origFetch(input, init);
    };
  }
})();
// Provide global fetch for tests that spy on or rely on fetch (Node 20 already provides fetch)
if (typeof globalThis.fetch === 'undefined') {
  // Dynamic import only if needed (Node < 18)
  globalThis.fetch = (...args) => import('node-fetch').then((mod) => mod.default(...args));
}

// Quiet noisy logs in tests while preserving unexpected errors
(() => {
  const originalError = console.error;
  const originalWarn = console.warn;
  const noisyPatterns = [
    /Warning: An update to .* inside a test was not wrapped in act\(\.\.\.\)\./i,
    /Erreur HTTP 500 de http:\/\/localhost:8002\/generate/i,
    /Impossible de contacter le service à http:\/\/rag_service:8001\/ingest/i,
    /GENERIC_REQUEST_TIMEOUT/i,
  ];
  console.error = (...args) => {
    const msg = args?.[0]?.toString?.() || '';
    if (noisyPatterns.some((re) => re.test(msg))) return;
    originalError.apply(console, args);
  };
  console.warn = (...args) => {
    const msg = args?.[0]?.toString?.() || '';
    if (noisyPatterns.some((re) => re.test(msg))) return;
    originalWarn.apply(console, args);
  };
})();

// Polyfill TextEncoder/TextDecoder for libraries like pdfkit/fontkit in Jest env
try {
  const { TextEncoder, TextDecoder } = require('util');
  if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
  if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
} catch {}
