# Security - Nexus Réussite

**Last Updated**: 2026-02-01
**Status**: Production-Ready

---

## 🔐 Security Overview

Nexus Réussite implements defense-in-depth security with multiple layers:

1. **Authentication** - NextAuth with secure JWT strategy
2. **Authorization** - Role-Based Access Control (RBAC)
3. **Data Protection** - Encrypted passwords, sanitized logs
4. **API Security** - Input validation, rate limiting
5. **Infrastructure** - HTTPS, secure headers, Docker isolation

---

## 🛡️ Authentication Architecture

### NextAuth Configuration

**File**: `lib/auth.ts`

**Strategy**: JWT (no database sessions)

```typescript
session: {
  strategy: 'jwt'  // Stateless, scalable
}
```

**Benefits**:
- ✅ No session storage required
- ✅ Horizontally scalable
- ✅ Fast (no DB lookups on each request)

### Secret Management

**Production Requirement**:
```bash
NEXTAUTH_SECRET=<64-character-random-hex>
```

**Generation**:
```bash
openssl rand -hex 32
```

**Enforcement**:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET must be set in production');
}
```

### Password Hashing

**Library**: bcryptjs

**Configuration**:
- Algorithm: bcrypt
- Rounds: 10 (default, secure)
- Salt: Auto-generated per password

```typescript
import bcrypt from 'bcryptjs';

// Hashing
const hashedPassword = await bcrypt.hash(plainPassword, 10);

// Verification
const isValid = await bcrypt.compare(plainPassword, hashedPassword);
```

---

## 👥 Role-Based Access Control (RBAC)

### User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| **ADMIN** | Full system access | All routes, all data |
| **ASSISTANTE** | Administrative support | Management routes, limited admin |
| **COACH** | Teaching staff | Own sessions, students assigned |
| **PARENT** | Student guardian | Own children data, payments |
| **ELEVE** | Student | Own data, sessions, resources |

**Enum Definition** (`types/enums.ts`):
```typescript
enum UserRole {
  ADMIN = 'ADMIN',
  ASSISTANTE = 'ASSISTANTE',
  COACH = 'COACH',
  PARENT = 'PARENT',
  ELEVE = 'ELEVE'
}
```

### Centralized Guards

**File**: `lib/guards.ts` (196 lines)

#### requireAuth()

Validates user is authenticated.

```typescript
const session = await requireAuth();
if (isErrorResponse(session)) return session; // 401 if not authenticated

// session is AuthSession here
const userId = session.user.id;
```

**Returns**:
- `AuthSession` if authenticated
- `NextResponse` with 401 if not authenticated

#### requireRole(role)

Validates user has specific role.

```typescript
const session = await requireRole('ADMIN');
if (isErrorResponse(session)) return session; // 401 or 403

// session is AuthSession with role='ADMIN'
```

**Returns**:
- `AuthSession` if user has required role
- `NextResponse` with 401 if not authenticated
- `NextResponse` with 403 if wrong role

#### requireAnyRole([roles])

Validates user has one of multiple roles.

```typescript
const session = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
if (isErrorResponse(session)) return session;

// session is AuthSession with role='ADMIN' or 'ASSISTANTE'
```

#### Helper Functions

**isOwner(session, userId)**: Check resource ownership
```typescript
if (!isOwner(session, resourceOwnerId)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**isStaff(session)**: Check if admin or assistante
```typescript
if (!isStaff(session)) {
  return NextResponse.json({ error: 'Staff only' }, { status: 403 });
}
```

### Usage Example

**Before** (Insecure, duplicated):
```typescript
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... admin logic
}
```

**After** (Secure, centralized):
```typescript
import { requireRole, isErrorResponse } from '@/lib/guards';

export async function GET(request: NextRequest) {
  const session = await requireRole('ADMIN');
  if (isErrorResponse(session)) return session;

  // ... admin logic (session is guaranteed ADMIN)
}
```

---

## 🔒 API Route Protection

### Protected Routes

| Route Pattern | Required Role | Guard Used |
|---------------|---------------|------------|
| `/api/admin/**` | ADMIN | `requireRole('ADMIN')` |
| `/api/assistante/**` | ADMIN, ASSISTANTE | `requireAnyRole(['ADMIN', 'ASSISTANTE'])` |
| `/api/coach/**` | COACH | `requireRole('COACH')` |
| `/api/parent/**` | PARENT | `requireRole('PARENT')` |
| `/api/student/**` | ELEVE | `requireRole('ELEVE')` |
| `/api/payments/**` | PARENT (or ADMIN) | `requireAnyRole(['PARENT', 'ADMIN'])` |
| `/api/sessions/**` | Authenticated | `requireAuth()` + ownership check |

### Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| **200** | OK | Request succeeded |
| **400** | Bad Request | Invalid input (validation error) |
| **401** | Unauthorized | Not authenticated (no session) |
| **403** | Forbidden | Authenticated but wrong role |
| **404** | Not Found | Resource doesn't exist |
| **500** | Internal Server Error | Unexpected server error |
| **503** | Service Unavailable | Database down, service unavailable |

**Error Response Format**:
```json
{
  "error": "Forbidden",
  "message": "Access denied. Required role: ADMIN"
}
```

---

## 🔍 Input Validation

### Zod Schemas

**Library**: Zod

**Example** (`app/api/payments/konnect/route.ts`):
```typescript
import { z } from 'zod';

const paymentSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  studentId: z.string().cuid(),
  amount: z.number().positive(),
  description: z.string().min(1).max(500)
});

// Validate
const validatedData = paymentSchema.parse(body); // Throws on invalid
```

**Benefits**:
- ✅ Type-safe (TypeScript infers types)
- ✅ Runtime validation
- ✅ Clear error messages
- ✅ Composable schemas

### Sanitization

**User Input**:
- ❌ Never trust user input
- ✅ Validate all fields
- ✅ Sanitize HTML (if accepting rich text)
- ✅ Escape SQL (Prisma prevents SQL injection)

**File Uploads** (if implemented):
- Validate file type (whitelist, not blacklist)
- Limit file size
- Scan for malware (ClamAV)
- Store outside webroot

---

## 📝 Logging & Monitoring

### Logging Best Practices

**DO**:
- ✅ Log authentication events (login, logout, failures)
- ✅ Log authorization failures (403 errors)
- ✅ Log security-relevant events (password changes, role changes)
- ✅ Log error messages only (no full error objects)

**DON'T**:
- ❌ Log passwords or tokens
- ❌ Log full user objects (may contain PII)
- ❌ Log database queries in production (may contain sensitive data)
- ❌ Log full error stack traces to client

**Example** (lib/auth.ts:76):
```typescript
console.error('Authentication error:', error instanceof Error ? error.message : 'Unknown error');
// ✅ Logs message only, not full error object
```

### Sanitized Errors

**Client Responses**:
```typescript
// ❌ BAD: Exposes internals
return NextResponse.json({ error: error.stack }, { status: 500 });

// ✅ GOOD: Generic message
return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
```

**Server Logs**:
```typescript
// ✅ Detailed for debugging (server-side only)
console.error('Payment processing failed:', {
  userId: session.user.id,
  amount,
  error: error.message
});
```

---

## 🔐 Data Protection

### Personally Identifiable Information (PII)

**PII Fields**:
- Email addresses
- Names (first, last)
- Phone numbers
- Addresses
- Birth dates
- Session notes
- Payment information

**Protection**:
1. **Database**:
   - Encrypted at rest (PostgreSQL with encryption)
   - SSL connections (`?sslmode=require`)

2. **Transit**:
   - HTTPS only (redirect HTTP → HTTPS)
   - TLS 1.2+

3. **Access**:
   - RBAC enforced
   - Audit logs (who accessed what, when)

4. **Retention**:
   - GDPR compliance (right to be forgotten)
   - Data minimization (collect only necessary data)

### Secrets Management

**Environment Variables**:
```bash
# ❌ Never commit
.env

# ✅ Commit examples only
.env.example
.env.ci.example
```

**Production Secrets**:
- Use secrets manager (AWS Secrets Manager, Azure Key Vault)
- Rotate regularly (90 days)
- Least privilege access

---

## 🚫 Common Vulnerabilities (OWASP Top 10)

### A01: Broken Access Control

**Mitigation**:
- ✅ Centralized RBAC guards (`lib/guards.ts`)
- ✅ Server-side enforcement (never trust client)
- ✅ Test coverage (15 RBAC tests)

### A02: Cryptographic Failures

**Mitigation**:
- ✅ bcrypt for passwords (industry standard)
- ✅ HTTPS enforced
- ✅ Secure session cookies (httpOnly, secure, sameSite)

### A03: Injection

**Mitigation**:
- ✅ Prisma ORM (parameterized queries, no string concat)
- ✅ Zod validation on inputs
- ✅ TypeScript type safety

### A04: Insecure Design

**Mitigation**:
- ✅ Threat modeling (STRIDE)
- ✅ Defense in depth (multiple layers)
- ✅ Security reviews (this document)

### A05: Security Misconfiguration

**Mitigation**:
- ✅ `NEXTAUTH_SECRET` required in production
- ✅ Debug mode disabled in production
- ✅ Rate limiting configured

### A06: Vulnerable Components

**Mitigation**:
- ✅ `npm audit` in CI (fail on moderate+)
- ✅ Dependabot enabled
- ✅ Regular updates (Next.js, Prisma, etc.)

### A07: Authentication Failures

**Mitigation**:
- ✅ No default credentials
- ✅ Session timeout (JWT expiry)
- ✅ Secure session storage (JWT, not localStorage)

### A08: Software & Data Integrity

**Mitigation**:
- ✅ Lock files (package-lock.json)
- ✅ CI pipeline (build, test, deploy)
- ✅ Code review required

### A09: Security Logging Failures

**Mitigation**:
- ✅ Auth events logged
- ✅ Error logging (sanitized)
- ✅ Monitoring (healthcheck endpoint)

### A10: Server-Side Request Forgery (SSRF)

**Mitigation**:
- ✅ No user-controlled URLs
- ✅ Whitelist external APIs only
- ✅ Network segmentation (Docker)

---

## 🧪 Security Testing

### Unit Tests

**File**: `__tests__/lib/guards.test.ts`

**Coverage**: 15 tests
- requireAuth() with valid/invalid sessions
- requireRole() with correct/incorrect roles
- requireAnyRole() with multiple roles
- Helper functions (isOwner, isStaff, isErrorResponse)

**Run**:
```bash
npm run test:unit -- __tests__/lib/guards.test.ts
```

### Integration Tests

**File**: `__tests__/api/rbac-admin.test.ts`

**Coverage**: RBAC enforcement
- Admin routes reject unauthenticated (401)
- Admin routes reject non-admin (403)
- Admin routes accept valid admin (200)
- Role isolation

**Run**:
```bash
npm run test:integration -- __tests__/api/rbac-admin.test.ts
```

### Manual Testing

**Checklist**:
- [ ] Login with valid credentials
- [ ] Login with invalid credentials (should fail)
- [ ] Access admin route as non-admin (should 403)
- [ ] Access protected route without login (should 401)
- [ ] Session expires after timeout
- [ ] Password reset flow secure
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked

---

## 📋 Security Checklist (Production)

### Before Deployment

- [ ] `NEXTAUTH_SECRET` set (64+ characters, random)
- [ ] `NODE_ENV=production`
- [ ] `debug: false` in NextAuth
- [ ] Database uses SSL (`?sslmode=require`)
- [ ] HTTPS enforced (redirect HTTP)
- [ ] Secure headers configured (CSP, HSTS, X-Frame-Options)
- [ ] Rate limiting enabled
- [ ] CORS configured (not `*`)
- [ ] Secrets in secrets manager (not .env)
- [ ] npm audit clean (no moderate+ vulnerabilities)

### After Deployment

- [ ] Monitor logs for auth failures
- [ ] Monitor 401/403 rates (spike = attack?)
- [ ] Test authentication flows
- [ ] Test authorization (try accessing admin as user)
- [ ] Verify HTTPS (check certificate)
- [ ] Run security scan (OWASP ZAP, Burp Suite)

### Regular Maintenance

- [ ] Rotate secrets (90 days)
- [ ] Update dependencies (monthly)
- [ ] Review access logs (weekly)
- [ ] Security training (team, quarterly)
- [ ] Penetration testing (yearly)

---

## 🚨 Incident Response

### If Breach Suspected

1. **Contain**: Disable compromised accounts, revoke tokens
2. **Investigate**: Check logs, identify scope
3. **Notify**: Users if PII exposed, authorities if required
4. **Remediate**: Patch vulnerability, rotate secrets
5. **Review**: Post-mortem, update procedures

### Contacts

- **Security Lead**: [Your Name]
- **DevOps**: [Team Email]
- **Legal**: [Compliance Officer]

---

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NextAuth.js Security](https://next-auth.js.org/configuration/options#security)
- [Prisma Security Best Practices](https://www.prisma.io/docs/guides/database/production-best-practices)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/)
- [GDPR Compliance](https://gdpr.eu/)

---

**Last Reviewed**: 2026-02-01
**Next Review**: 2026-05-01
**Maintainer**: Équipe Nexus Réussite
