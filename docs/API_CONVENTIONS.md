# API Conventions - Nexus Réussite

**Last Updated**: 2026-02-01
**Status**: Production Standard

---

## 🎯 Overview

This document defines the API design conventions for all Nexus Réussite endpoints. Following these patterns ensures consistency, maintainability, and excellent developer experience.

**Key Principles**:
- **Consistent**: All endpoints follow the same patterns
- **Type-Safe**: Zod validation + TypeScript throughout
- **Secure**: Centralized auth/authz, sanitized errors
- **Predictable**: Standard HTTP status codes and error formats
- **Testable**: Easy to mock and test

---

## 🏗️ Architecture

### File Structure

```
app/api/
├── admin/
│   ├── users/
│   │   └── route.ts          # CRUD for users
│   └── dashboard/
│       └── route.ts          # Admin dashboard
├── payments/
│   └── konnect/
│       └── route.ts          # Payment creation
└── health/
    └── route.ts              # Health check

lib/
├── api/
│   ├── errors.ts             # Error handling utilities
│   └── helpers.ts            # Common API helpers
├── validation/
│   ├── index.ts              # Validation exports
│   ├── common.ts             # Reusable schemas
│   ├── users.ts              # User schemas
│   ├── sessions.ts           # Session schemas
│   └── payments.ts           # Payment schemas
└── guards.ts                 # Auth/authz guards
```

### Imports Structure

Standard import order for API routes:

```typescript
// 1. External dependencies
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

// 2. Internal dependencies
import { prisma } from '@/lib/prisma';

// 3. Auth/authz
import { requireRole, isErrorResponse } from '@/lib/guards';

// 4. Validation
import { createUserSchema, updateUserSchema } from '@/lib/validation';

// 5. Helpers and errors
import { parseBody, assertExists } from '@/lib/api/helpers';
import { successResponse, handleApiError, ApiError } from '@/lib/api/errors';
```

---

## 🔐 Authentication & Authorization

### Using Guards

**Always** use centralized guards from `lib/guards.ts`:

```typescript
import { requireRole, isErrorResponse } from '@/lib/guards';

export async function GET(request: NextRequest) {
  try {
    // Require specific role
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // session is guaranteed to be AuthSession with role='ADMIN'
    const userId = session.user.id;
    // ... route logic
  } catch (error) {
    return handleApiError(error, 'GET /api/admin/users');
  }
}
```

**Available Guards**:
- `requireAuth()` - Any authenticated user
- `requireRole(role)` - Specific role (ADMIN, COACH, PARENT, ELEVE, ASSISTANTE)
- `requireAnyRole([roles])` - One of multiple roles

**Never** write manual authentication checks:

```typescript
// ❌ DON'T DO THIS
const session = await getServerSession(authOptions);
if (!session || session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ✅ DO THIS
const session = await requireRole('ADMIN');
if (isErrorResponse(session)) return session;
```

---

## ✅ Input Validation

### Using Zod Schemas

**Always** define and use Zod schemas from `lib/validation/`:

**Example**: Define schema (`lib/validation/users.ts`):

```typescript
import { z } from 'zod';
import { emailSchema, passwordSchema } from './common';

export const createUserSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: z.nativeEnum(UserRole),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

**Use schema in route**:

```typescript
import { parseBody } from '@/lib/api/helpers';
import { createUserSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Parse and validate body (throws ZodError on invalid)
    const data = await parseBody(request, createUserSchema);

    // data is now typed as CreateUserInput and validated
    const user = await prisma.user.create({ data: ... });

    return successResponse({ user }, 201);
  } catch (error) {
    return handleApiError(error, 'POST /api/admin/users');
  }
}
```

### Validation Helpers

**parseBody()** - Parse and validate JSON body:
```typescript
const data = await parseBody(request, createUserSchema);
```

**parseSearchParams()** - Parse and validate query parameters:
```typescript
const params = parseSearchParams(request, listUsersSchema);
// params.limit, params.offset, etc. are validated
```

**Common Schemas** (`lib/validation/common.ts`):
- `idSchema` - CUID validation
- `emailSchema` - Email validation (lowercase)
- `passwordSchema` - Min 8 chars, letter + number
- `paginationSchema` - limit/offset validation
- `phoneSchema` - International phone format
- `amountSchema` - Positive integer amounts

---

## 🚫 Error Handling

### Standard Error Format

All API errors return:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "details": { ... }  // Optional
}
```

### Error Codes

| Code | HTTP Status | Usage |
|------|-------------|-------|
| `VALIDATION_ERROR` | 422 | Zod validation failed |
| `UNAUTHORIZED` | 401 | Not authenticated |
| `FORBIDDEN` | 403 | Wrong role/permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Duplicate/conflict |
| `INTERNAL_ERROR` | 500 | Unexpected error |
| `SERVICE_UNAVAILABLE` | 503 | Database down |

### Using ApiError

**Throw typed errors**:

```typescript
import { ApiError } from '@/lib/api/errors';

// Check for conflicts
if (existingUser) {
  throw ApiError.conflict('User with this email already exists');
}

// Check existence
if (!resource) {
  throw ApiError.notFound('Resource');
}

// Validate ownership
if (resource.userId !== session.user.id) {
  throw ApiError.forbidden('You do not own this resource');
}

// Bad request
if (!id) {
  throw ApiError.badRequest('ID is required');
}
```

**Helper functions**:

```typescript
import { assertExists, assertOwnership } from '@/lib/api/helpers';

// Assert resource exists (throws ApiError.notFound if null)
const user = await prisma.user.findUnique({ where: { id } });
assertExists(user, 'User');

// Assert ownership (throws ApiError.forbidden if not owner)
assertOwnership(session.user.id, resource.userId);
```

### Handling Errors

**Always** use `handleApiError()` in catch blocks:

```typescript
export async function POST(request: NextRequest) {
  try {
    // ... route logic
  } catch (error) {
    return handleApiError(error, 'POST /api/users');
  }
}
```

**What handleApiError() does**:
1. **ApiError**: Convert to JSON response with correct status
2. **ZodError**: Format validation errors as 422 response
3. **Other errors**: Return generic 500 (logs details server-side)
4. **Security**: Never exposes stack traces or internals to client

---

## 📥 Request Handling

### Parsing JSON Bodies

**Use parseBody()** - Safe JSON parsing with error handling:

```typescript
// ❌ DON'T DO THIS
const body = await request.json();  // Throws on invalid JSON

// ✅ DO THIS
const body = await safeJsonParse(request);  // Throws ApiError.badRequest

// ✅ OR THIS (with validation)
const data = await parseBody(request, schema);  // Parse + validate
```

### Query Parameters

**Use parseSearchParams()** for validated query params:

```typescript
const params = parseSearchParams(request, listUsersSchema);
// params: { limit: number, offset: number, role?: UserRole, ... }
```

### Pagination

**Standard pagination** (limit/offset):

```typescript
import { getPagination, createPaginationMeta } from '@/lib/api/helpers';

// Parse params
const params = parseSearchParams(request, listUsersSchema);
const { skip, take } = getPagination(params.limit, params.offset);

// Query with pagination
const [items, total] = await Promise.all([
  prisma.user.findMany({ skip, take }),
  prisma.user.count()
]);

// Create pagination metadata
return successResponse({
  users: items,
  pagination: createPaginationMeta(total, params.limit, params.offset)
});
```

**Pagination Response Format**:

```json
{
  "users": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true,
    "page": 1,
    "totalPages": 5
  }
}
```

---

## 📤 Response Handling

### Success Responses

**Use successResponse()** for consistent success format:

```typescript
import { successResponse, HttpStatus } from '@/lib/api/errors';

// 200 OK (default)
return successResponse({ users });

// 201 Created
return successResponse({ user }, HttpStatus.CREATED);

// 204 No Content
return successResponse(null, HttpStatus.NO_CONTENT);
```

### Response Formats

**List endpoint** (GET /api/resource):
```json
{
  "items": [...],
  "pagination": { ... }
}
```

**Single resource** (GET /api/resource/:id):
```json
{
  "id": "...",
  "name": "...",
  ...
}
```

**Create/Update** (POST/PATCH /api/resource):
```json
{
  "success": true,
  "message": "Resource created successfully",
  "resource": { ... }
}
```

**Delete** (DELETE /api/resource/:id):
```json
{
  "success": true,
  "message": "Resource deleted successfully"
}
```

---

## 🧪 Testing

### Integration Test Structure

```typescript
describe('GET /api/admin/users', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mocks
  });

  it('should return 401 when not authenticated', async () => {
    // Mock unauthenticated state
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 403 when user lacks permission', async () => {
    // Mock wrong role
    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it('should return 422 for invalid input', async () => {
    // Send invalid data
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toBe('VALIDATION_ERROR');
    expect(data.details).toBeDefined();
  });

  it('should return 200 with valid data', async () => {
    // Mock successful case
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.users).toBeDefined();
  });
});
```

### Test Coverage Requirements

**Minimum test cases for each endpoint**:
1. ✅ 401 - Unauthenticated access
2. ✅ 403 - Wrong role/permission
3. ✅ 422 - Invalid input (Zod validation)
4. ✅ 404 - Resource not found (if applicable)
5. ✅ 409 - Conflict (if applicable)
6. ✅ 200/201 - Success case with valid data

---

## 📋 Endpoint Checklist

Use this checklist when creating or refactoring endpoints:

### Authentication & Authorization
- [ ] Uses `requireRole()` or `requireAnyRole()`
- [ ] Checks `isErrorResponse()` and returns early
- [ ] No manual session checks

### Validation
- [ ] Defines Zod schema in `lib/validation/`
- [ ] Uses `parseBody()` or `parseSearchParams()`
- [ ] No manual validation logic

### Error Handling
- [ ] Uses `try/catch` with `handleApiError()`
- [ ] Throws `ApiError` for business logic errors
- [ ] Uses `assertExists()` for resource checks

### Response Format
- [ ] Uses `successResponse()` for success cases
- [ ] Returns consistent JSON structure
- [ ] Includes proper HTTP status codes

### Code Quality
- [ ] Follows import structure
- [ ] Has JSDoc comments
- [ ] No sensitive data in logs
- [ ] No hardcoded values (use env vars)

### Testing
- [ ] Has integration tests
- [ ] Tests 401, 403, 422, 404, 200/201
- [ ] Tests are deterministic (no flakiness)

---

## 🔧 Common Patterns

### Pattern 1: List Resources with Filters

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Parse and validate params
    const params = parseSearchParams(request, listResourcesSchema);
    const { skip, take } = getPagination(params.limit, params.offset);

    // Build where clause
    const where: Prisma.ResourceWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } }
      ];
    }

    // Query with pagination
    const [items, total] = await Promise.all([
      prisma.resource.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.resource.count({ where })
    ]);

    return successResponse({
      items,
      pagination: createPaginationMeta(total, params.limit, params.offset)
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/resources');
  }
}
```

### Pattern 2: Create Resource

```typescript
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Validate input
    const data = await parseBody(request, createResourceSchema);

    // Check for conflicts
    const existing = await prisma.resource.findFirst({
      where: { name: data.name }
    });
    if (existing) {
      throw ApiError.conflict('Resource with this name already exists');
    }

    // Create resource
    const resource = await prisma.resource.create({
      data: {
        ...data,
        createdById: session.user.id
      }
    });

    return successResponse({
      success: true,
      message: 'Resource created successfully',
      resource
    }, HttpStatus.CREATED);
  } catch (error) {
    return handleApiError(error, 'POST /api/resources');
  }
}
```

### Pattern 3: Update Resource

```typescript
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Get ID and validate body
    const body = await request.json();
    const { id, ...data } = body;
    if (!id) throw ApiError.badRequest('ID is required');

    const validated = updateResourceSchema.parse(data);

    // Check resource exists
    const resource = await prisma.resource.findUnique({ where: { id } });
    assertExists(resource, 'Resource');

    // Check ownership (if applicable)
    assertOwnership(session.user.id, resource.createdById);

    // Update resource
    const updated = await prisma.resource.update({
      where: { id },
      data: validated
    });

    return successResponse({
      success: true,
      message: 'Resource updated successfully',
      resource: updated
    });
  } catch (error) {
    return handleApiError(error, 'PATCH /api/resources');
  }
}
```

### Pattern 4: Delete Resource

```typescript
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Get ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) throw ApiError.badRequest('ID is required');

    // Check resource exists
    const resource = await prisma.resource.findUnique({ where: { id } });
    assertExists(resource, 'Resource');

    // Check ownership (if applicable)
    assertOwnership(session.user.id, resource.createdById);

    // Delete resource
    await prisma.resource.delete({ where: { id } });

    return successResponse({
      success: true,
      message: 'Resource deleted successfully'
    });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/resources');
  }
}
```

---

## 🎯 Examples

### ✅ Good: Refactored Admin Users Endpoint

See `app/api/admin/users/route.ts` for a complete example following all conventions:
- Uses `requireRole('ADMIN')`
- Validates with `parseBody()` and `parseSearchParams()`
- Uses `ApiError` for business logic errors
- Uses `successResponse()` and `handleApiError()`
- Includes pagination with `getPagination()` and `createPaginationMeta()`
- Has comprehensive integration tests

### ✅ Good: Refactored Konnect Payment Endpoint

See `app/api/payments/konnect/route.ts` for payment handling:
- Uses `requireRole('PARENT')`
- Validates with `createKonnectPaymentSchema`
- Uses `assertExists()` for student validation
- Implements idempotency with deterministic external IDs
- Returns 201 Created on success

---

## 📚 References

### Related Documentation
- [Security](./SECURITY.md) - Auth/authz, RBAC, OWASP mitigations
- [Test Strategy](./TEST_STRATEGY.md) - Testing approach and coverage
- [Database Strategy](./DB_STRATEGY.md) - Database setup and migrations

### External Resources
- [Zod Documentation](https://zod.dev/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [REST API Best Practices](https://restfulapi.net/)

---

**Last Reviewed**: 2026-02-01
**Next Review**: 2026-05-01
**Maintainer**: Équipe Nexus Réussite
