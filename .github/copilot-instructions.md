# Nexus Réussite - AI Coding Agent Instructions

## Project Overview
**Nexus Réussite** is a premium educational platform for French system high school students in Tunisia, combining human coaching with AI assistance. Built with Next.js 14 (App Router), TypeScript, Tailwind CSS, PostgreSQL, and Prisma.

## Architecture Essentials

### Dual API Architecture
- **Next.js API Routes** (`/app/api/*`): Main application APIs (auth, payments, sessions)
- **FastAPI Backend** (`/apps/api/`): Supplementary Python services (RAG, agents, analytics)
- **Proxy Configuration**: FastAPI accessible via `/pyapi/*` through `next.config.mjs` rewrites

### Key Business Model
- **Subscription + Credits System**: Monthly plans give credit budgets for human services
- **Credit Costs**: 1 crédit = 1h online course, 1.25 crédits = 1h in-person, 1.5 crédits = 2h group workshop
- **ARIA AI Assistant**: RAG-based (currently basic text search, designed for pgvector expansion)

### Authentication & Roles
- **NextAuth.js** with Prisma adapter
- **Roles**: ADMIN, ASSISTANTE, COACH, PARENT, ELEVE
- **Auth file**: `lib/auth.ts` with bcrypt password hashing
- **Role-based dashboard routing**: `/app/(dashboard)/*` with middleware protection

## Development Workflows

### Local Development
```bash
# Standard development
npm run dev                    # Next.js dev server
docker compose up -d           # Database only

# Dual architecture development  
npm run dev:all               # Both Next.js + FastAPI with concurrently
npm run dev:api              # FastAPI only (port 8000)
```

### Database Operations
```bash
# Prisma workflows (primary)
npm run db:generate          # Generate Prisma client
npm run db:migrate          # Dev migrations
npm run db:migrate:deploy   # Production migrations
npm run db:seed            # Seed with initial data

# Python migrations (secondary)
npm run db:migrate:py       # Alembic for FastAPI services
```

### Testing Strategy
```bash
# Multi-tier testing approach
npm run test:unit           # Jest + RTL (components, utils)
npm run test:integration    # API routes with mocked services
npm run test:e2e           # Playwright (full user journeys)
npm run test:coverage      # Coverage reports
```

## Critical Code Patterns

### ARIA AI Integration
- **Frontend**: `components/ui/aria-chat.tsx`, `components/ui/aria-widget.tsx`
- **Backend**: `/app/api/aria/chat/route.ts` 
- **RAG Logic**: `lib/aria.ts` with `searchKnowledgeBase()` (ready for pgvector upgrade)
- **Current State**: Basic text search, designed for vector embedding expansion

### Credit System Logic
- **Core Utils**: `lib/credits.ts` - `calculateCreditCost()`, `checkCreditBalance()`, `debitCredits()`
- **Business Rules**: Credits roll over 1 month only, 24h cancellation for courses, 48h for workshops
- **Admin Override**: Manual credit refunds via assistant dashboard

### Component Architecture
- **shadcn/ui**: Base components in `components/ui/`
- **Sections**: Page sections in `components/sections/` (hero, offers, etc.)
- **Dashboard**: Role-specific components in `components/dashboard/`
- **Animation**: Framer Motion throughout, especially in hero sections

### API Route Patterns
```typescript
// Standard pattern for protected routes
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({error: 'Unauthorized'}, {status: 401})
  
  // Role-based access control
  if (!['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
    return NextResponse.json({error: 'Forbidden'}, {status: 403})
  }
}
```

## Deployment & Infrastructure

### Production Deployment
- **Docker Multi-stage**: `Dockerfile.prod` with standalone output
- **Asset Handling**: `scripts/copy-public-assets.js` fixes standalone image serving
- **Database**: PostgreSQL with connection pooling
- **Nginx**: Reverse proxy with SSL, Brotli compression, maintenance mode

### Environment Configuration
- **Development**: `.env.local` (gitignored)
- **Production**: `.env.production` with real secrets
- **Templates**: `env.example`, `env.local.example` for setup
- **Docker**: `docker-compose.yml` (dev), `docker-compose.prod.yml` (production)

### Key Scripts
```bash
scripts/prepare-deployment.sh    # Pre-deployment checks and build
scripts/deploy/prod-deploy.sh    # Complete production deployment
scripts/db/migrate-deploy.sh     # Database migration helper
```

## Project-Specific Conventions

### File Organization
- **Business Logic**: Centralized in `/feuille_route/` (French specs - read these first!)
- **Types**: Global enums in `types/enums.ts`, Prisma-generated types via `@prisma/client`
- **Constants**: Business rules in `lib/constants.ts` (subscription plans, ARIA addons)
- **Utils**: Shared utilities in `lib/` (auth, credits, email, etc.)

### French Business Context
- **Target Market**: French system lycéens (high school) in Tunisia  
- **Premium Positioning**: Every interaction must reflect "excellence française"
- **Key Concept**: "Pédagogie Augmentée" (Augmented Pedagogy) = Human coaches + AI assistance

### Testing Philosophy
- **Mock External Services**: OpenAI, SMTP, payment providers always mocked
- **Real Business Logic**: Credit calculations, validations tested with real functions
- **E2E Critical Paths**: User registration, payment flow, booking system
- **Component Isolation**: Heavy use of Jest mocks for Framer Motion, Next.js features

## Integration Points

### Payment System (Konnect)
- **Local Payments**: Konnect API for Tunisia
- **Webhooks**: HMAC SHA-256 signature validation required
- **Fallback**: Manual bank transfer process for international payments

### Email System
- **Provider**: SMTP via Hostinger
- **Templates**: Inline HTML in `lib/email.ts`
- **Transactional**: Welcome emails, session confirmations, credit expiry warnings

### External Services
- **Jitsi Meet**: Embedded video calls for coaching sessions
- **OpenAI**: GPT-4o-mini for ARIA responses (API key server-side only)
- **Monitoring**: Optional Sentry integration via `instrumentation.ts`

## Common Pitfalls to Avoid

1. **Never expose OpenAI API key client-side** - all ARIA calls go through `/api/aria/*`
2. **Always check credit balance before session booking** - use `checkCreditBalance()`
3. **Mock Framer Motion in tests** - prevents animation-related test failures
4. **Use `npm run build` not `build:base`** - ensures assets are copied correctly
5. **Role-based access control** - check session.user.role in all protected routes
6. **French content compliance** - maintain premium positioning in all user-facing text

Remember: The `/feuille_route/` directory contains the complete business specifications and design system. Always reference these documents when implementing new features or making UX decisions.