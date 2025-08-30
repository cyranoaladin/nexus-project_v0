# ARIA: PDF generation and RAG ingestion

This document summarizes how ARIA works end-to-end for LaTeX-to-PDF generation and RAG (retrieval-augmented generation) ingestion in this project, and how to test it locally.

## Overview

- The chat orchestrator builds a full student context from the database, calls an LLM service to produce a response (optionally containing LaTeX), and decides whether to generate a PDF.
- If a PDF is requested, the orchestrator tries the remote PDF generator first, and falls back to a local PDF creation using pdfkit when needed.
- When a sufficiently rich AI response is produced, the content may be ingested into a RAG service for future retrieval.
- The chat UI shows a clear “Télécharger le PDF” button whenever a document URL is returned.

Key files:

- lib/aria/orchestrator.ts — main logic (LLM + PDF + RAG)
- lib/aria/services.ts — HTTP client for LLM, PDF generator, and RAG
- lib/aria/pdf-fallback.ts — local PDF generation using pdfkit
- app/api/aria/chat/route.ts — API route that exposes the orchestrator
- e2e/aria-pdf-download.spec.ts — Playwright test to ensure a PDF link is rendered

## Environment variables

The following env vars control ARIA microservice endpoints (defaults are suitable for local dev):

- LLM_SERVICE_URL (default: http://localhost:8001)
  - Expects endpoint POST /chat
- PDF_GENERATOR_SERVICE_URL (default: http://localhost:8002)
  - Expects endpoint POST /generate
- RAG_SERVICE_URL (default: http://localhost:8000)
  - Expects endpoint POST /ingest

Note: In some flows (e.g., tests or docker compose), the orchestrator may call the RAG service via an internal hostname (rag_service:8001). Ensure your container network or host mappings align with your environment.

## Running tests

Unit/integration tests (Jest):

- npm test

End-to-end tests (Playwright):

- To avoid conflicts when port 3000 is in use, run tests on a different port (recommended):
  E2E_PORT=3100 npx playwright test --reporter=line
- Alternatively, if you already have a dev server on http://localhost:3000 and want Playwright to reuse it, set reuseExistingServer: true in playwright.config.ts (webServer section). The default config starts its own server.

Coverage highlights (E2E and Jest):

- PDF generation end-to-end (including fallback) returns a valid document URL
- Chat UI renders a visible “Télécharger le PDF” button when a PDF URL is provided
- ARIA orchestrator sanitizes LaTeX, wraps minimal content if needed, and logs local fallback usage
- RAG ingestion triggers under specific content conditions (less strict in tests)

## Local PDF generation

When the remote PDF generator is unavailable or returns an error, ARIA will generate a PDF locally using pdfkit and place it under public/generated. The URL returned looks like /generated/<filename>.pdf and is immediately downloadable from the UI.

## Troubleshooting

- Port 3000 already in use when running Playwright:
  - Use a different port via E2E_PORT, e.g. E2E_PORT=3100 npx playwright test --reporter=line
  - Or enable reuseExistingServer in playwright.config.ts

- Warning: “next start does not work with output: standalone”
  - The current config uses next start; tests still pass. If you switch to output: 'standalone', use node .next/standalone/server.js with the correct env and port.

- LLM/PDF/RAG microservices unavailable:
  - Ensure the services are running on the configured ports, or rely on orchestrator’s local PDF fallback.

## UI behavior

- When ARIA returns a documentUrl, the ChatWindow renders a prominent “Télécharger le PDF” button linking to the file.
- Attachments uploaded in the chat are passed to the orchestrator and included in context for the LLM.

## Notes

- The orchestrator applies light LaTeX sanitation and safety checks before calling the remote PDF service.
- In test environments, ingest thresholds are lower so that content is more easily ingested by the RAG service, keeping tests fast and deterministic.
