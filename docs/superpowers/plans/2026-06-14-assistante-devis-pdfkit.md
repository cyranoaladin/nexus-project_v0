# Assistante Devis PDFKit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile client-side `html2pdf` quote export with a server-side PDFKit quote renderer matching the quality and stability of Nexus invoice PDFs.

**Architecture:** The assistant keeps its HTML preview for on-screen guidance, but PDF download posts structured quote data to a protected Next route. The server validates and renders a real A4 PDF using PDFKit, avoiding browser canvas capture, cropped text, and broken page offsets.

**Tech Stack:** Next.js route handlers, PDFKit, Jest, Playwright E2E, existing `requireAnyRole` guards.

---

### Task 1: PDF renderer contract

**Files:**
- Create: `lib/quote/pdf.ts`
- Test: `__tests__/lib/quote/pdf.test.ts`

- [ ] Write a failing test that renders a representative quote and confirms the buffer is a real PDF, starts at page 1, contains expected text, and fits in controlled A4 pages.
- [ ] Implement `renderQuotePDF(data)` with PDFKit design tokens inspired by `lib/invoice/pdf.ts`.
- [ ] Run the test until green.

### Task 2: Protected API route

**Files:**
- Create: `app/api/assistante/quotes/pdf/route.ts`
- Test: `__tests__/api/assistante.quotes.pdf.route.test.ts`

- [ ] Write a failing test for assistant/admin access, PDF response headers, and anonymous denial.
- [ ] Implement a `POST` route that requires `ASSISTANTE` or `ADMIN`, validates JSON, calls `renderQuotePDF`, and streams the PDF.
- [ ] Run the route tests until green.

### Task 3: Assistant UI integration

**Files:**
- Modify: `src/static-pages/assistante-devis-v3/app.js`
- Modify: `src/static-pages/assistante-devis-v3/index.html`
- Test: `__tests__/offres-nexus-data.test.js`

- [ ] Update the existing PDF export test so the assistant no longer depends on `html2pdf` for downloads.
- [ ] Replace `generatePDF()` with a `fetch('/api/assistante/quotes/pdf')` download flow.
- [ ] Remove the external `html2pdf` script from the static page.
- [ ] Keep the preview HTML as an on-screen preview only.

### Task 4: Verification and deployment

**Files:**
- Deploy modified files to `/var/www/nexus-project_v0`.

- [ ] Run targeted Jest tests locally and on the server.
- [ ] Run `npm run build` locally and on the server.
- [ ] Reload `nexus-prod`.
- [ ] Run Playwright E2E against production: authenticate as assistante, generate a quote, download the PDF, inspect page count and size.
