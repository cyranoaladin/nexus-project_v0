# Homepage Hub Deux Offres Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la homepage corporate par un hub court qui met en avant Stages Printemps 2026 et la Plateforme EAF, avec un bandeau promo global et une navigation inchangée.

**Architecture:** Le layout global reçoit un bandeau promo client léger. La homepage devient une composition serveur de sections statiques, avec deux utilitaires clients ciblés pour le countdown et l’aide au choix. Les sections GSAP existantes sont retirées de la homepage mais conservées et archivées.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, next/font, Jest, ESLint.

---

## Chunk 1: Archive and Theme Tokens

### Task 1: Archive the old homepage and section sources

**Files:**
- Create: `archive/homepage-corporate-v1/README.md`
- Create: `archive/homepage-corporate-v1/app/page.tsx`
- Create: `archive/homepage-corporate-v1/components/sections/*.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Copy the current homepage into the archive tree**
- [ ] **Step 2: Copy the eight GSAP section files into the archive tree**
- [ ] **Step 3: Add the archive README with the replacement date**
- [ ] **Step 4: Verify the archive contains the old homepage and section sources**

Run: `find archive/homepage-corporate-v1 -maxdepth 3 -type f | sort`
Expected: homepage file, section files, and README are listed.

### Task 2: Extend Tailwind with homepage product tokens

**Files:**
- Modify: `tailwind.config.mjs`
- Test: `app/page.tsx`

- [ ] **Step 1: Add `nexus-green`, `nexus-green-dark`, `nexus-purple`, `nexus-purple-dark`, `nexus-red`, `nexus-amber`, `nexus-bg`, `nexus-bg-alt` under `theme.extend.colors`**
- [ ] **Step 2: Keep existing brand and semantic tokens untouched**
- [ ] **Step 3: Verify no naming collision with existing tokens**

Run: `grep -n "nexus-green\\|nexus-purple\\|nexus-bg" tailwind.config.mjs`
Expected: all new tokens are present exactly once.

## Chunk 2: Global Promo Banner

### Task 3: Add the global promo banner component

**Files:**
- Create: `components/layout/PromoBanner.tsx`
- Modify: `app/layout.tsx`
- Test: `__tests__/homepage/promo-banner.test.tsx`

- [ ] **Step 1: Write a failing test for desktop links, close behavior, and mobile message rotation**
- [ ] **Step 2: Run the targeted test and confirm failure**
- [ ] **Step 3: Implement `PromoBanner` as a client component with local close state and mobile auto-rotation**
- [ ] **Step 4: Inject `PromoBanner` into `app/layout.tsx` immediately before `{children}`**
- [ ] **Step 5: Run the targeted banner test and confirm it passes**

Run: `npx jest --config jest.config.js __tests__/homepage/promo-banner.test.tsx --runInBand`
Expected: PASS.

## Chunk 3: Homepage Sections

### Task 4: Create shared CTA and countdown utilities

**Files:**
- Create: `components/sections/homepage/CTAButton.tsx`
- Create: `components/sections/homepage/CountdownChip.tsx`
- Test: `__tests__/homepage/countdown-chip.test.tsx`

- [ ] **Step 1: Write a failing countdown test for J-X rendering**
- [ ] **Step 2: Implement `CountdownChip` with 60-second refresh and safe date math**
- [ ] **Step 3: Implement `CTAButton` variants for stage, EAF, and outline styles**
- [ ] **Step 4: Run the countdown test**

Run: `npx jest --config jest.config.js __tests__/homepage/countdown-chip.test.tsx --runInBand`
Expected: PASS.

### Task 5: Build `HomeHero` and `FlagshipOffers`

**Files:**
- Create: `components/sections/homepage/HomeHero.tsx`
- Create: `components/sections/homepage/FlagshipOffers.tsx`
- Test: `__tests__/homepage/homepage-page.test.tsx`

- [ ] **Step 1: Write a failing homepage rendering test covering the hero, the two flagship cards, and link targets**
- [ ] **Step 2: Implement `HomeHero` with server-safe CTA content and reassurance row**
- [ ] **Step 3: Implement `FlagshipOffers` with equal-height grid cards, feature lists, countdown chips, and desktop comparison table**
- [ ] **Step 4: Run the homepage rendering test**

Run: `npx jest --config jest.config.js __tests__/homepage/homepage-page.test.tsx --runInBand`
Expected: PASS.

### Task 6: Build `TrustSection`, `HomepageTestimonials`, and `HomepageFinalCTA`

**Files:**
- Create: `components/sections/homepage/TrustSection.tsx`
- Create: `components/sections/homepage/HomepageTestimonials.tsx`
- Create: `components/sections/homepage/HomepageFinalCTA.tsx`
- Test: `__tests__/homepage/homepage-page.test.tsx`

- [ ] **Step 1: Extend the homepage rendering test to cover trust metrics, testimonial tags, and final CTA links**
- [ ] **Step 2: Implement the three static sections with the approved copy and product colors**
- [ ] **Step 3: Re-run the homepage rendering test**

Run: `npx jest --config jest.config.js __tests__/homepage/homepage-page.test.tsx --runInBand`
Expected: PASS.

### Task 7: Build the interactive `DecisionHelper`

**Files:**
- Create: `components/sections/homepage/DecisionHelper.tsx`
- Test: `__tests__/homepage/decision-helper.test.tsx`

- [ ] **Step 1: Write failing tests for the Première and Terminale recommendation paths plus the back button**
- [ ] **Step 2: Implement the client-side state machine and recommendation mapping**
- [ ] **Step 3: Run the decision helper tests**

Run: `npx jest --config jest.config.js __tests__/homepage/decision-helper.test.tsx --runInBand`
Expected: PASS.

## Chunk 4: Compose the New Homepage

### Task 8: Replace the old homepage composition

**Files:**
- Modify: `app/page.tsx`
- Test: `__tests__/homepage/homepage-page.test.tsx`

- [ ] **Step 1: Remove the GSAP homepage imports**
- [ ] **Step 2: Keep `CorporateNavbar`, `CorporateFooter`, and `Toaster` intact**
- [ ] **Step 3: Compose the six new homepage sections between navbar and footer**
- [ ] **Step 4: Add homepage metadata export matching the approved SEO copy**
- [ ] **Step 5: Re-run the homepage rendering test**

Run: `grep -n "GSAP" app/page.tsx`
Expected: no GSAP imports remain in the active homepage.

## Chunk 5: Verification

### Task 9: Run final checks

**Files:**
- Verify: `app/page.tsx`
- Verify: `components/layout/PromoBanner.tsx`
- Verify: `components/sections/homepage/*.tsx`
- Verify: `archive/homepage-corporate-v1/**`

- [ ] **Step 1: Run targeted Jest tests**
- [ ] **Step 2: Run `npm run lint`**
- [ ] **Step 3: Run `npm run build`**
- [ ] **Step 4: Grep for stale homepage GSAP imports and dated February promo text**
- [ ] **Step 5: Summarize results with any residual warnings**

Run: `npx jest --config jest.config.js __tests__/homepage/promo-banner.test.tsx __tests__/homepage/countdown-chip.test.tsx __tests__/homepage/decision-helper.test.tsx __tests__/homepage/homepage-page.test.tsx --runInBand`
Expected: PASS.

Run: `npm run lint`
Expected: PASS.

Run: `npm run build`
Expected: PASS.
