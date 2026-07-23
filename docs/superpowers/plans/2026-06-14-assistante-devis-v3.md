# Assistante Devis V3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the `nexus_assistante_v3` internal quote wizard inside the authenticated assistante dashboard.

**Architecture:** Serve the standalone HTML/CSS/JS through protected Next.js dashboard routes instead of exposing it as a public static page. The dashboard page hosts the tool in an iframe so the existing static wizard can run unchanged while the parent route remains integrated with Nexus navigation.

**Tech Stack:** Next.js App Router, NextAuth session checks, static HTML/CSS/JS, Jest navigation tests, Playwright E2E.

---

### Task 1: Navigation Contract

**Files:**
- Modify: `__tests__/components/navigation/assistante-facturation-nav.test.ts`
- Modify: `components/navigation/navigation-config.ts`
- Modify: `components/navigation/NavigationItem.tsx`

- [x] **Step 1: Write the failing test**
  Add a test that requires `Assistant devis` at `/dashboard/assistante/devis` for `ASSISTANTE` only.

- [x] **Step 2: Run test to verify it fails**
  Run: `npm test -- --runInBand __tests__/components/navigation/assistante-facturation-nav.test.ts`
  Expected: FAIL because the route is not in navigation yet.

- [ ] **Step 3: Implement the minimal navigation entry**
  Add the navigation item and a supported Lucide icon.

- [ ] **Step 4: Run test to verify it passes**
  Run: `npm test -- --runInBand __tests__/components/navigation/assistante-facturation-nav.test.ts`

### Task 2: Protected Static Tool Route

**Files:**
- Create: `src/static-pages/assistante-devis-v3/*`
- Create: `app/dashboard/assistante/devis/page.tsx`
- Create: `app/dashboard/assistante/devis/app/route.ts`
- Create: `app/dashboard/assistante/devis/assets/[file]/route.ts`
- Modify: `next.config.mjs`
- Modify: `lib/security-headers.ts`

- [ ] **Step 1: Copy source assets into the project**
  Copy `index.html`, `styles.css`, and `app.js` from `/home/alaeddine/Documents/Nexus/Business_Model_Nexus/nexus_assistante_v3`.

- [ ] **Step 2: Add authenticated dashboard page**
  Render a concise internal page with an iframe pointing to `/dashboard/assistante/devis/app`.

- [ ] **Step 3: Add protected route handlers**
  Serve HTML and assets only after a valid `ASSISTANTE` or `ADMIN` session check.

- [ ] **Step 4: Include static files in standalone tracing**
  Add the static-pages folder to `outputFileTracingIncludes`.

- [ ] **Step 5: Allow the required iframe/CDN policy**
  Add `frame-src 'self'` and required script CDNs for this internal tool.

### Task 3: Verification And Deploy

**Files:**
- Production server: `<APP_DIR>`

- [ ] **Step 1: Run unit tests**
  Run focused navigation/auth tests.

- [ ] **Step 2: Build locally or on server**
  Run `npm run build`.

- [ ] **Step 3: Deploy to production**
  Copy changed files/assets, run production build, verify `.next/standalone/.env`, reload PM2.

- [ ] **Step 4: Run E2E**
  Sign in as assistante and verify `/dashboard/assistante/devis` loads the wizard.
