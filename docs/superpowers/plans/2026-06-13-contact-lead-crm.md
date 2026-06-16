# Contact Lead CRM Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist marketing contact form submissions as CRM leads and notify Nexus by email.

**Architecture:** `/api/contact` remains the public endpoint. It delegates payload normalization/persistence to a small CRM service and notification formatting to the existing email template/mailer layer. Prisma owns the durable prospect table.

**Tech Stack:** Next.js route handlers, Prisma/PostgreSQL, Zod, Nodemailer through `lib/email/mailer.ts`, Jest.

---

## Chunk 1: Contact Lead CRM

### Task 1: Route Tests

**Files:**
- Modify: `__tests__/api/contact.route.test.ts`

- [ ] Add tests proving valid payloads create `prisma.contactLead.create`.
- [ ] Add tests proving internal notification email is sent.
- [ ] Add tests proving notification failure still returns success after persistence.
- [ ] Add tests proving invalid email returns `400`.
- [ ] Run `npx jest --config jest.unit.config.js __tests__/api/contact.route.test.ts --runInBand` and confirm failure before implementation.

### Task 2: Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260613000000_add_contact_leads/migration.sql`

- [ ] Add `ContactLeadStatus` enum.
- [ ] Add `ContactLead` model mapped to `contact_leads`.
- [ ] Add indexes for status, source, createdAt and email.
- [ ] Add SQL migration for the enum/table/indexes.

### Task 3: CRM Service And Email Template

**Files:**
- Create: `lib/crm/contact-leads.ts`
- Modify: `lib/email/templates.ts`

- [ ] Add normalization/validation schema for contact form payloads.
- [ ] Persist normalized fields with `status: NEW`.
- [ ] Add a `contactLeadNotification` template.
- [ ] Send notification using `sendMail`.
- [ ] Treat mail failure as non-fatal after DB creation.

### Task 4: API Route

**Files:**
- Modify: `app/api/contact/route.ts`

- [ ] Keep existing rate limiting.
- [ ] Replace placeholder success with `captureContactLead`.
- [ ] Return `{ ok: true, leadId }` on success.
- [ ] Return stable error codes for invalid payload and persistence failure.

### Task 5: Verification

- [ ] Run `npx prisma generate`.
- [ ] Run `npx jest --config jest.unit.config.js __tests__/api/contact.route.test.ts __tests__/api/contact.rate-limit.test.ts --runInBand`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
