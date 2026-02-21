# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/audit-a796`

---

## Agent Instructions

If you are blocked and need user clarification, mark the current step with `[!]` in plan.md before stopping.

---

## Workflow Steps

### [x] Step: Requirements

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint). Avoid steps that are too granular (single function) or too broad (entire feature).

Important: unit tests must be part of each implementation task, not separate tasks. Each task should implement the code and its tests together, if relevant.

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Phase 1: Automated Analysis & Metrics Collection

### [x] Step: TypeScript and Linting Analysis
<!-- chat-id: f1ca2c31-64f7-484d-b34b-57d932d5c1b7 -->

Run automated static analysis tools to identify type errors and code quality issues.

**Tasks**:
- Run `npm run typecheck` and capture output
- Search for `any` types, `@ts-ignore`, `@ts-expect-error` using Grep
- Run `npm run lint` and categorize warnings vs errors
- Identify most common ESLint violations
- Document findings with file paths and line numbers

**Output**: Save findings to `phase1_automated_findings.md` (TypeScript section)

**Verification**: 
- TypeScript check completes (exit code captured)
- Lint results are categorized by severity
- Quantitative metrics extracted (count of `any`, count of violations)

### [ ] Step: Security and Dependency Scanning

Perform automated security analysis to identify vulnerabilities and insecure patterns.

**Tasks**:
- Run `npm audit` and capture vulnerability counts by severity
- Search for hardcoded secrets (patterns: API_KEY, PASSWORD, SECRET, TOKEN)
- Scan for sensitive data in logs (console.log patterns with password/secret/token)
- Search for `dangerouslySetInnerHTML` usage (XSS risk)
- Review `.env.example` for completeness
- Search for raw SQL queries vs Prisma usage

**Output**: Append to `phase1_automated_findings.md` (Security section)

**Verification**:
- npm audit results show vulnerability breakdown
- Secret scanning patterns executed
- All findings documented with file paths

### [ ] Step: Build Analysis and Bundle Optimization

Analyze production build output to identify bundle size issues and optimization opportunities.

**Tasks**:
- Run `npm run build` and capture output
- Extract First Load JS metrics for all routes
- Identify largest bundles (>200KB)
- Check for proper code splitting (`use client` directive usage)
- Search for dynamic imports usage
- Analyze image optimization (`next/image` usage)

**Output**: Append to `phase1_automated_findings.md` (Build & Performance section)

**Verification**:
- Build completes successfully
- Bundle size metrics extracted and documented
- Optimization opportunities identified

### [ ] Step: Test Coverage Analysis

Run test suite with coverage reporting to identify untested code paths.

**Tasks**:
- Run `npm test -- --coverage` and capture coverage metrics
- Run `npm run test:integration` and document results
- Run `npm run test:e2e` and document results
- Extract coverage percentages (statements, branches, functions, lines)
- Identify critical paths with low/no coverage
- Document test execution time

**Output**: Append to `phase1_automated_findings.md` (Testing section)

**Verification**:
- All test suites execute
- Coverage percentages documented
- Untested critical paths identified

### [ ] Step: Code Pattern Analysis

Search for specific code patterns that indicate quality or security issues.

**Tasks**:
- Search for TODO/FIXME comments
- Count try/catch blocks vs total functions (error handling coverage)
- Identify deprecated Tailwind classes
- Search for `forEach` + `prisma` patterns (potential N+1 queries)
- Count `use client` directives vs total components
- Search for long files (>300 lines)

**Output**: Append to `phase1_automated_findings.md` (Code Patterns section)

**Verification**:
- All search patterns executed
- Quantitative metrics compiled
- Findings documented with examples

### [ ] Step: Compile Phase 1 Metrics

Consolidate all automated findings into structured metrics dashboard.

**Tasks**:
- Create metrics summary table with all quantitative data
- Categorize automated findings by type and severity
- Calculate preliminary scores for automated dimensions
- Identify top issues from automated analysis

**Output**: Finalize `phase1_automated_findings.md` with metrics summary

**Verification**:
- Metrics dashboard is complete and well-formatted
- All automated tools results are included
- Findings are categorized and prioritized

---

## Phase 2: Manual Deep-Dive Review

### [ ] Step: Architecture and Dependencies Review

Analyze application architecture, component structure, and dependency management.

**Tasks**:
- Read `ARCHITECTURE.md` and `ARCHITECTURE_TECHNIQUE.md`
- Review `app/` directory structure (App Router patterns)
- Review `lib/` organization (business logic separation)
- Analyze state management patterns (Zustand stores in `lib/stores/`)
- Check for circular dependencies (imports analysis)
- Assess separation of concerns (UI, business logic, data access)
- Identify architectural anti-patterns

**Output**: Save findings to `phase2_manual_findings.md` (Architecture section)

**Verification**:
- All architecture docs reviewed
- Directory structure analyzed
- Findings include specific examples and file paths

### [ ] Step: Authentication Security Review

Conduct in-depth security review of authentication mechanisms.

**Tasks**:
- Review `auth.ts` and `auth.config.ts`
- Verify password hashing implementation (bcrypt usage)
- Analyze JWT configuration and security settings
- Review session management and cookie security
- Audit password reset flow security
- Verify student activation token implementation
- Check for authentication bypass vulnerabilities

**Output**: Append to `phase2_manual_findings.md` (Security - Authentication section)

**Verification**:
- All auth files reviewed
- Security findings documented with severity ratings
- Specific vulnerabilities or issues cited with line numbers

### [ ] Step: Authorization and RBAC Review

Audit authorization enforcement and role-based access control implementation.

**Tasks**:
- Review `middleware.ts` route protection
- Analyze `lib/rbac.ts` policy definitions
- Review all files in `lib/access/` directory
- Audit API route guards across all routes in `app/api/`
- Check role elevation protections
- Verify resource ownership validation
- Identify missing authorization checks

**Output**: Append to `phase2_manual_findings.md` (Security - Authorization section)

**Verification**:
- All RBAC files reviewed
- API routes sampled for authorization coverage
- Missing guards documented with file paths

### [ ] Step: Input Validation and Data Protection Review

Review input validation coverage and sensitive data handling.

**Tasks**:
- Sample 20-30 API routes for Zod schema coverage
- Identify routes without proper validation
- Review file upload validation (if applicable)
- Check query parameter sanitization
- Audit environment variable security
- Review secret management practices
- Check for sensitive data in logs (from Phase 1 findings)
- Review security headers in middleware

**Output**: Append to `phase2_manual_findings.md` (Security - Validation section)

**Verification**:
- API routes validation sampled
- Missing validation documented
- Security headers reviewed

### [ ] Step: Database Schema and Migration Review

Analyze database design quality, integrity constraints, and migration history.

**Tasks**:
- Review `prisma/schema.prisma` thoroughly
- Assess normalization level and relationship design
- Verify foreign key constraints
- Check cascade delete rules for appropriateness
- Analyze index coverage for query patterns
- Review data types and nullability rules
- Review recent migrations in `prisma/migrations/`
- Check for destructive migration operations

**Output**: Append to `phase2_manual_findings.md` (Database section)

**Verification**:
- Schema comprehensively reviewed
- All 38 models analyzed
- Findings include specific model/field references

### [ ] Step: Critical Business Logic Review - Credits System

Review credits and payment system for correctness and security.

**Tasks**:
- Review `lib/credits.ts` implementation
- Analyze race condition handling
- Verify idempotency guarantees
- Check transaction integrity
- Review refund logic correctness
- Audit invoice generation in `lib/invoice/`
- Review payment API routes in `app/api/payments/`

**Output**: Append to `phase2_manual_findings.md` (Business Logic - Credits section)

**Verification**:
- All credits-related files reviewed
- Critical issues documented with severity
- Transaction safety assessed

### [ ] Step: Critical Business Logic Review - Session Booking

Review session booking system for concurrency and data integrity.

**Tasks**:
- Review `lib/session-booking.ts`
- Analyze double-booking prevention mechanisms
- Check availability conflict handling
- Verify credit deduction atomicity
- Review transaction isolation
- Test idempotency guarantees
- Review session API routes in `app/api/sessions/`

**Output**: Append to `phase2_manual_findings.md` (Business Logic - Sessions section)

**Verification**:
- Session booking logic reviewed
- Concurrency issues identified (if any)
- Recommendations documented

### [ ] Step: Critical Business Logic Review - ARIA AI System

Review ARIA AI integration for security and reliability.

**Tasks**:
- Review `lib/aria.ts` and `lib/aria-streaming.ts`
- Check for prompt injection vulnerabilities
- Verify context isolation per student
- Review error handling and fallbacks
- Audit API key security
- Check rate limiting implementation (Upstash Redis)
- Review `lib/rag-client.ts` for RAG security
- Review ARIA API routes in `app/api/aria/`

**Output**: Append to `phase2_manual_findings.md` (Business Logic - ARIA section)

**Verification**:
- All ARIA files reviewed
- Security risks documented
- Rate limiting assessed

### [ ] Step: API Design and Conventions Review

Audit API route design for REST best practices and consistency.

**Tasks**:
- Create inventory of all API routes in `app/api/`
- Sample 30-40 routes for REST convention compliance
- Check HTTP methods usage (GET, POST, PATCH, DELETE)
- Verify status codes appropriateness (200, 201, 400, 401, 403, 404, 500)
- Review error response format consistency
- Check validation error messages quality
- Assess API documentation (inline comments)
- Review rate limiting coverage

**Output**: Append to `phase2_manual_findings.md` (API Design section)

**Verification**:
- API routes inventoried
- Convention violations documented
- Consistency issues identified

### [ ] Step: Performance Review - Database and React Patterns

Identify performance bottlenecks in database queries and React code.

**Tasks**:
- Review Prisma queries for N+1 patterns (from Phase 1 findings)
- Check for missing `include` optimizations
- Verify `select` usage for field projection
- Analyze Server Components vs Client Components usage
- Review Suspense boundaries
- Check dynamic imports for code splitting
- Review caching strategies (React cache, unstable_cache)
- Identify memory leak risks (React hooks dependencies)

**Output**: Append to `phase2_manual_findings.md` (Performance section)

**Verification**:
- Database query patterns reviewed
- React performance issues documented
- Optimization opportunities identified with examples

### [ ] Step: Code Quality Sampling Review

Sample codebase for code quality issues and maintainability concerns.

**Tasks**:
- Identify and review top 20 largest files
- Review files with highest complexity (if measurable)
- Review recently changed files
- Check for code duplication (DRY violations)
- Assess function length (>50 lines flagged)
- Check cyclomatic complexity
- Review error handling consistency
- Assess async/await patterns

**Output**: Append to `phase2_manual_findings.md` (Code Quality section)

**Verification**:
- Sample files reviewed
- Quality issues documented with examples
- Refactoring opportunities identified

---

## Phase 3: Documentation & DevOps Review

### [ ] Step: Documentation Completeness Review

Assess documentation quality and identify gaps.

**Tasks**:
- Review `README.md` for completeness (setup, env vars, testing, deployment)
- Review `ARCHITECTURE.md` and `ARCHITECTURE_TECHNIQUE.md` for accuracy
- Verify docs match current codebase state
- Check API route documentation
- Review code comments (JSDoc coverage for public APIs)
- Track TODO/FIXME from Phase 1 findings
- Identify missing documentation

**Output**: Save findings to `phase3_docs_devops_findings.md` (Documentation section)

**Verification**:
- All major docs reviewed
- Gaps documented
- Outdated information identified

### [ ] Step: CI/CD and DevOps Review

Review continuous integration pipeline and deployment configuration.

**Tasks**:
- Review `.github/workflows/` CI configuration
- Assess job completeness (lint, test, build, security)
- Check parallelization effectiveness
- Review caching strategy
- Assess failure handling
- Review `Dockerfile` for multi-stage build efficiency and security
- Review `docker-compose.yml` configuration
- Check `.env.example` completeness
- Review deployment scripts (if present)

**Output**: Append to `phase3_docs_devops_findings.md` (DevOps section)

**Verification**:
- CI/CD pipeline reviewed
- Docker configuration assessed
- Recommendations documented

### [ ] Step: Accessibility Compliance Review

Conduct spot-check of accessibility compliance (WCAG 2.1 AA).

**Tasks**:
- Sample 10 representative pages/components
- Check semantic HTML usage
- Verify ARIA attributes correctness
- Test keyboard navigation patterns (focus management)
- Verify color contrast claims (≥4.5:1)
- Check form labels and error messages
- Verify focus indicators
- Review screen reader compatibility

**Output**: Append to `phase3_docs_devops_findings.md` (Accessibility section)

**Verification**:
- 10 pages/components sampled
- WCAG compliance level assessed
- Issues documented with specific examples

### [ ] Step: UI/UX Consistency Review

Review design system adherence and UI consistency.

**Tasks**:
- Review Design System v2.0 migration status
- Check design token usage (`lib/theme/tokens.ts`)
- Verify shadcn/ui pattern consistency
- Identify deprecated classes/styles (from Phase 1 findings)
- Review responsive design (mobile, tablet, desktop)
- Check loading states (skeletons, spinners)
- Review error states (form validation, API errors)
- Assess component library usage consistency

**Output**: Append to `phase3_docs_devops_findings.md` (UI/UX section)

**Verification**:
- Design system adherence assessed
- Inconsistencies documented
- Deprecated patterns identified

---

## Phase 4: Synthesis & Report Generation

### [ ] Step: Consolidate and Categorize Findings

Compile all findings from Phases 1-3 and organize by dimension and priority.

**Tasks**:
- Merge findings from all phase reports
- Categorize by 11 audit dimensions (Architecture, Code Quality, Security, Performance, Database, Testing, API Design, Documentation, DevOps, Accessibility, UI/UX)
- Assign severity levels (P0, P1, P2, P3) to each finding
- Tag findings by subsystem (auth, credits, ARIA, sessions, etc.)
- Remove duplicates and consolidate related findings
- Count findings by dimension and severity

**Output**: Create consolidated findings structure in `COMPREHENSIVE_AUDIT_REPORT.md` (draft)

**Verification**:
- All phase findings included
- Issues properly categorized and prioritized
- No duplicate findings

### [ ] Step: Create Metrics Dashboard and Calculate Health Score

Compile all quantitative metrics and calculate overall health score.

**Tasks**:
- Create metrics dashboard with data from Phase 1
- Add manual review metrics from Phases 2-3
- Calculate health score (0-100) using weighted formula:
  - Security: 30%
  - Code Quality: 20%
  - Performance: 15%
  - Testing: 15%
  - Documentation: 10%
  - Architecture: 10%
- Create comparison tables for key metrics
- Document scoring methodology

**Output**: Create `audit_metrics.md` and add to report

**Verification**:
- All metrics compiled
- Health score calculated with justification
- Metrics dashboard is comprehensive

### [ ] Step: Write Detailed Recommendations

Create specific, actionable recommendations for each finding.

**Tasks**:
- For each P0/P1 finding, write detailed remediation steps
- Include code examples where helpful
- Estimate effort (Small, Medium, Large, XL)
- Provide references to best practices or documentation
- Prioritize quick wins vs long-term improvements
- Cross-reference related findings

**Output**: Add recommendations to each section of `COMPREHENSIVE_AUDIT_REPORT.md`

**Verification**:
- Every finding has a recommendation
- Recommendations are specific and actionable
- Effort estimates included

### [ ] Step: Write Executive Summary

Create high-level overview for stakeholders.

**Tasks**:
- Write overall health assessment
- Summarize top 5 critical findings
- List top 5 recommendations with business impact
- Conduct risk assessment
- Highlight key metrics and health score
- Write conclusion with next steps
- Define success metrics for improvements

**Output**: Add Executive Summary section to `COMPREHENSIVE_AUDIT_REPORT.md`

**Verification**:
- Summary is concise (1-2 pages)
- Understandable by non-technical stakeholders
- Key findings and recommendations highlighted

### [ ] Step: Finalize Comprehensive Audit Report

Complete and polish the final audit report.

**Tasks**:
- Structure report according to PRD Section 4.1
- Write all 11 dimension sections with findings and recommendations
- Add overall recommendations section (P0, P1, P2-P3 breakdown)
- Write conclusion with next steps
- Add appendices (detailed metrics, code examples, tool outputs)
- Format markdown for readability
- Add table of contents
- Cross-check against Final Checklist (spec Section 6.4)
- Proofread for clarity and completeness

**Output**: Finalize `COMPREHENSIVE_AUDIT_REPORT.md`

**Verification**:
- Report follows PRD structure
- All 11 dimensions addressed
- All critical subsystems reviewed
- Findings are prioritized and actionable
- Executive summary complete
- Metrics dashboard included
- Final checklist verified (all ✅)

### [ ] Step: Update Plan and Mark Complete

Update plan.md to reflect completed work and mark all steps as done.

**Tasks**:
- Mark all implementation steps as [x] in plan.md
- Verify all deliverables are created
- Ensure artifacts are in correct location
- Document any deviations from original plan
- Add final notes or observations

**Output**: Updated `plan.md` with all steps marked complete

**Verification**:
- All steps marked [x]
- Deliverables verified:
  - ✅ `.zenflow/tasks/audit-a796/phase1_automated_findings.md`
  - ✅ `.zenflow/tasks/audit-a796/phase2_manual_findings.md`
  - ✅ `.zenflow/tasks/audit-a796/phase3_docs_devops_findings.md`
  - ✅ `.zenflow/tasks/audit-a796/COMPREHENSIVE_AUDIT_REPORT.md`
  - ✅ `.zenflow/tasks/audit-a796/audit_metrics.md`
