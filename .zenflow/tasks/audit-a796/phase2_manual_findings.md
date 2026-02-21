# Phase 2: Manual Deep-Dive Review — Findings

**Report Date**: 2026-02-21  
**Audit Scope**: Interface Maths 2025-2026  
**Phase**: Manual Code Review & Security Analysis

---

## Security Review — Backend API

### Overview

The FastAPI backend provides authentication, user management, and content tree API endpoints. It uses JWT-based authentication with SQLite database (default) or PostgreSQL for production.

**Components Analyzed**:
- **Framework**: FastAPI 0.115.0+
- **Database**: SQLAlchemy 2.0.32 + SQLite/PostgreSQL
- **Authentication**: JWT (python-jose) + OAuth2 + bcrypt password hashing
- **API Endpoints**: 5 routes (auth, user management, content tree)
- **Lines of Code**: ~450 LOC (excluding tests)

---

### 1. CORS Configuration

**Status**: ✅ **Properly Implemented** (with minor concerns)

**File**: `apps/backend/app/main.py:20-28`

```python
if settings.CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
```

**Findings**:

✅ **Strengths**:
- CORS is **optional** and only enabled when `CORS_ORIGINS` is explicitly set
- Origins are configured via environment variable (not hardcoded)
- Properly uses `allow_credentials=True` for cookie/auth support

⚠️ **Issues**:
- **P2**: `allow_methods=["*"]` and `allow_headers=["*"]` are overly permissive
  - **Impact**: Allows any HTTP method (PUT, DELETE, PATCH) and any custom header
  - **Recommendation**: Restrict to necessary methods: `["GET", "POST", "OPTIONS"]`
  - **Fix**:
    ```python
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    ```

**Score**: 85/100

---

### 2. Input Validation

**Status**: ⚠️ **Partially Implemented**

**Findings**:

✅ **Strengths**:
- FastAPI uses Pydantic for response models (`UserRead`, `GroupRead`, `DirNode`, `FileNode`)
- OAuth2 form data validated by FastAPI's `OAuth2PasswordRequestForm`
- Path traversal protection in `/api/tree/{subpath:path}` endpoint:
  ```python
  abs_dir.relative_to(root.resolve())  # Prevents path traversal
  ```

❌ **Critical Gaps**:

**P0 — No Input Validation for Login Endpoint** (`auth.py:16-26`):
- Email and password are **not validated** before database query
- No length limits, format checks, or sanitization
- **Risk**: Potential DoS via extremely long passwords (bcrypt limited to 72 bytes but still CPU-intensive)
- **Fix**: Add Pydantic model:
  ```python
  from pydantic import BaseModel, EmailStr, Field

  class LoginRequest(BaseModel):
      email: EmailStr
      password: Field(str, min_length=1, max_length=128)

  @router.post("/token")
  async def login_for_access_token(
      credentials: LoginRequest,
      db: Session = Depends(get_db),
  ):
      user = db.query(User).filter(User.email == credentials.email).one_or_none()
      ...
  ```

**P1 — No Validation for Tree Endpoint**:
- `subpath` parameter is sanitized but not validated against injection attacks
- No max path depth limit (potential DoS via deep directory traversal)

**P2 — Email Format Not Enforced**:
- User model allows any string for email field (no `EmailStr` type)
- **File**: `users.py:41`
- **Risk**: Invalid email addresses in database

**Score**: 60/100

---

### 3. SQL Injection Protection

**Status**: ✅ **Excellent** — No vulnerabilities found

**Findings**:

All database queries use **SQLAlchemy ORM** with parameterized queries:

```python
# auth.py:22 — Safe parameterized query
user = db.query(User).filter(User.email == form_data.username).one_or_none()

# users.py:77 — Safe filter_by
grp = db.query(Group).filter_by(code=code).one_or_none()

# users.py:88 — Safe filter with comparison operator
usr = db.query(User).filter_by(email=email).one_or_none()
```

✅ **Protections**:
- **No raw SQL** found (no `.execute()` with string interpolation)
- **No `text()` constructs** with user input
- All queries use ORM methods (`.query()`, `.filter()`, `.filter_by()`)
- SQLAlchemy **automatically parameterizes** all queries

**Verification**: Searched codebase for:
- `session.execute(f"...")`  ❌ Not found
- `sqlalchemy.text(...)` ❌ Not found
- String concatenation in queries ❌ Not found

**Score**: 100/100 ✅

---

### 4. Authentication & Authorization

**Status**: ⚠️ **Good Implementation** (with important gaps)

#### 4.1 Password Hashing

**File**: `security.py:18-42`

✅ **Strengths**:
- Uses **bcrypt_sha256** (stronger than plain bcrypt for >72 byte passwords)
- Passwords truncated to 72 bytes (bcrypt limit)
- `deprecated="auto"` ensures future-proof hashing

```python
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")
```

#### 4.2 JWT Token Security

✅ **Strengths**:
- HS256 algorithm (symmetric signing)
- Token expiry properly set (`exp` claim)
- Tokens include `sub` (user ID), `email`, `role`

❌ **Critical Issues**:

**P0 — Weak Fallback Secret Key** (`security.py:27-32`):
```python
def get_secret_key() -> str:
    if settings.SECRET_KEY:
        return settings.SECRET_KEY
    return "dev-ephemeral-secret-key-change-me"  # ⚠️ WEAK!
```
- **Risk**: If `SECRET_KEY` env var is unset in production, uses predictable dev secret
- **Impact**: Attackers can forge JWT tokens with full access
- **Fix**: **Require** `SECRET_KEY` in production:
  ```python
  def get_secret_key() -> str:
      if not settings.SECRET_KEY:
          raise RuntimeError("SECRET_KEY must be set in production")
      return settings.SECRET_KEY
  ```

**P1 — No Token Refresh Mechanism**:
- Tokens expire in 60 minutes (default) but **no refresh tokens**
- Users must re-authenticate frequently (poor UX)
- **Recommendation**: Implement refresh tokens with longer expiry

**P2 — No Token Revocation**:
- No blacklist or database tracking for revoked tokens
- Compromised tokens valid until expiry
- **Impact**: Cannot revoke access if token stolen

#### 4.3 Role-Based Access Control (RBAC)

✅ **Well Implemented** (`security.py:75-78`):
```python
def require_teacher(user: User = Depends(get_current_user)) -> User:
    if user.role != "teacher":
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    return user
```

✅ **Test Coverage**:
- Auth endpoints tested (`test_auth.py`)
- Teacher-only endpoint tested with 403 for students ✅

**Score**: 70/100

---

### 5. Rate Limiting

**Status**: ❌ **Not Implemented** — Critical Gap

**Findings**:

❌ **No rate limiting** on any endpoint:
- Login endpoint (`/auth/token`) vulnerable to brute-force attacks
- API endpoints (`/api/tree`) vulnerable to DoS
- No account lockout after failed login attempts

**Attack Scenarios**:
1. **Brute Force**: Attacker tries 10,000 passwords/second on `/auth/token`
2. **DoS**: Attacker floods `/api/tree` with requests

**Recommendations**:

**P0 — Add Rate Limiting Middleware**:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@router.post("/token")
@limiter.limit("5/minute")  # 5 login attempts per minute
async def login_for_access_token(...):
    ...
```

**P1 — Implement Account Lockout**:
- Lock account after 5 failed login attempts (15-minute cooldown)
- Store failed attempts in database or Redis

**P2 — API Rate Limits**:
- `/api/tree`: 100 requests/minute per IP
- `/auth/me`: 60 requests/minute per user

**Score**: 0/100 ❌

---

### 6. Environment Variable & Secrets Management

**Status**: ✅ **Good Practices** (with minor issues)

**File**: `config.py`, `.env.example`

✅ **Strengths**:
- All secrets loaded from environment variables (`.env` file or system env)
- `.env.example` provided (no secrets committed)
- `python-dotenv` for local development
- Pydantic Settings for validation
- Provisional passwords written to **secure outputs directory** (not logged)
  ```python
  out_file = out_dir / f"bootstrap_credentials_{ts}.csv"  # Secure file
  ```

⚠️ **Issues**:

**P1 — Secret Key Not Mandatory** (already covered in Auth section)

**P2 — Database URL Defaults to Local SQLite**:
- File: `config.py:49-58`
- **Risk**: Production may accidentally use SQLite instead of PostgreSQL
- **Recommendation**: Require explicit `DATABASE_URL` in production

**P3 — Teacher Email in Code** (`config.py:35-38`):
```python
TEACHER_EMAILS: List[str] = [
    "alaeddine.benrhouma@ert.tn",  # ⚠️ Hardcoded default
]
```
- **Impact**: Minor information disclosure (email visible in public repo)
- **Recommendation**: Remove default, require env var

**Score**: 85/100

---

### 7. Security Headers

**Status**: ✅ **Well Configured** (Nginx layer)

**Files**: 
- `deploy/nginx/maths.labomaths.tn.conf.sample` (production)
- `deploy/docker/nginx.conf` (Docker dev)

✅ **Headers Implemented**:

| Header | Status | Value |
|--------|--------|-------|
| `X-Frame-Options` | ✅ | `DENY` (Docker) / `SAMEORIGIN` (prod) |
| `X-Content-Type-Options` | ✅ | `nosniff` |
| `X-XSS-Protection` | ✅ | `1; mode=block` (deprecated but harmless) |
| `Referrer-Policy` | ✅ | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | ⚠️ | Allows `unsafe-inline` (see below) |
| `Permissions-Policy` | ✅ | Disables camera/microphone/geolocation (Docker only) |
| `Strict-Transport-Security` | ❌ | **Commented out** |

⚠️ **Issues**:

**P0 — HSTS Disabled** (`deploy/docker/nginx.conf:65`):
```nginx
# add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```
- **Risk**: No HTTPS enforcement, vulnerable to downgrade attacks
- **Recommendation**: Enable HSTS in production (after HTTPS configured)

**P1 — CSP Allows `unsafe-inline`**:
```nginx
Content-Security-Policy "... script-src 'self' 'unsafe-inline'; ..."
```
- **Risk**: XSS attacks possible via inline scripts
- **Impact**: Mitigated by site code review (48 `innerHTML` usages found earlier)
- **Recommendation**: Remove `unsafe-inline`, use nonces or CSP Level 3

**P2 — No `X-Permitted-Cross-Domain-Policies`**:
- **Recommendation**: Add `add_header X-Permitted-Cross-Domain-Policies "none";`

**Score**: 80/100

---

### 8. Additional Security Concerns

#### 8.1 Logging & Monitoring

**Status**: ❌ **Not Implemented**

❌ **Missing**:
- No logging of authentication events (login success/failure)
- No security event monitoring (403 errors, suspicious requests)
- No audit trail for admin actions (`/auth/admin/users`)

**Recommendations**:
```python
import logging
logger = logging.getLogger("security")

@router.post("/token")
async def login_for_access_token(...):
    user = db.query(User).filter(User.email == form_data.username).one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for {form_data.username}")
        raise HTTPException(...)
    logger.info(f"Successful login: {user.email}")
    ...
```

#### 8.2 Error Information Disclosure

**Status**: ⚠️ **Minor Issue**

**File**: `auth.py:24`
```python
raise HTTPException(status_code=400, detail="Incorrect email or password")
```

✅ **Good**: Generic error message (doesn't reveal if email exists)

**File**: `main.py:54`
```python
raise HTTPException(status_code=500, detail=str(e))
```

⚠️ **P2 Issue**: Exposes internal error details (stack traces, file paths)
- **Fix**: Return generic error in production

#### 8.3 Password Policy

**Status**: ❌ **Not Enforced**

❌ **Missing**:
- No minimum password length (could be 1 character)
- No complexity requirements
- No password strength validation

**Recommendation**:
```python
import re

def validate_password_strength(password: str) -> bool:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if not re.search(r"[a-z]", password):
        raise ValueError("Password must contain lowercase letter")
    if not re.search(r"[A-Z]", password):
        raise ValueError("Password must contain uppercase letter")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must contain number")
    return True
```

#### 8.4 Database Security

**File**: `db.py:16`
```python
engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)
```

✅ **Good**: `echo=False` (no SQL queries logged)

⚠️ **Concern**: SQLite default for production
- SQLite lacks: concurrent writes, user permissions, network isolation
- **Recommendation**: Require PostgreSQL for production

#### 8.5 Docker Security

**File**: `Dockerfile:1-31`

✅ **Strengths**:
- Uses official Python slim image (minimal attack surface)
- No `root` user explicitly set (defaults to root ⚠️)
- `PYTHONDONTWRITEBYTECODE=1` prevents .pyc artifacts

❌ **P1 Issue — Running as Root**:
- Container runs as `root` user by default
- **Fix**:
  ```dockerfile
  RUN useradd -m -u 1000 appuser
  USER appuser
  ```

---

## Summary & Metrics

### Security Score by Category

| Category | Score | Status |
|----------|-------|--------|
| **CORS Configuration** | 85/100 | 🟡 Good |
| **Input Validation** | 60/100 | 🟠 Needs Work |
| **SQL Injection Protection** | 100/100 | 🟢 Excellent |
| **Authentication & Authorization** | 70/100 | 🟡 Good |
| **Rate Limiting** | 0/100 | 🔴 Critical |
| **Secrets Management** | 85/100 | 🟡 Good |
| **Security Headers** | 80/100 | 🟡 Good |
| **Logging & Monitoring** | 0/100 | 🔴 Missing |
| **Error Handling** | 70/100 | 🟡 Acceptable |
| **Password Policy** | 0/100 | 🔴 Missing |

**Overall Backend Security Score**: **55/100** 🟠

---

### Critical Findings (P0)

1. **No Rate Limiting** — Vulnerable to brute-force and DoS attacks
2. **Weak Fallback Secret Key** — Predictable JWT signing key in dev mode
3. **No Input Validation on Login** — DoS risk via long passwords
4. **HSTS Disabled** — No HTTPS enforcement

### High Priority Findings (P1)

1. **No Token Refresh Mechanism** — Poor UX, no revocation
2. **No Security Logging** — Cannot detect attacks
3. **Docker Runs as Root** — Container escape risk
4. **No Account Lockout** — Brute-force protection missing

### Medium Priority Findings (P2)

1. **Overly Permissive CORS** — `allow_methods=["*"]`
2. **CSP Allows `unsafe-inline`** — XSS risk
3. **No Email Format Validation** — Invalid data in DB
4. **Password Policy Not Enforced** — Weak passwords allowed

---

### Test Coverage

**Files Reviewed**:
- `tests/test_auth.py`: ✅ 115 lines, covers auth flow and RBAC
- `tests/test_main_static_cors.py`: ✅ Minimal CORS testing
- `tests/test_tree.py`: ✅ Tree endpoint tested
- `tests/test_more_coverage.py`: ✅ Bootstrap and user creation

**Coverage Assessment**:
- ✅ Authentication flow tested
- ✅ Authorization (teacher-only endpoint) tested
- ❌ **No security-specific tests** (XSS, SQL injection, rate limiting)
- ❌ **No penetration testing** artifacts found

**Recommendation**: Add security test suite:
```python
def test_sql_injection_attempt():
    # Test that SQL injection in email field fails safely
    r = client.post("/auth/token", data={
        "username": "admin' OR '1'='1",
        "password": "anything"
    })
    assert r.status_code in [400, 401]  # Not 500

def test_rate_limiting():
    # Test that 6 failed logins result in rate limit
    for i in range(6):
        r = client.post("/auth/token", data={"username": "test", "password": "wrong"})
    assert r.status_code == 429  # Too Many Requests
```

---

## Recommendations Priority Matrix

| Priority | Finding | Effort | Impact | Action |
|----------|---------|--------|--------|--------|
| **P0** | Add rate limiting | M | High | Implement SlowAPI middleware |
| **P0** | Enforce SECRET_KEY | S | Critical | Raise error if unset |
| **P0** | Input validation (login) | S | High | Add Pydantic models |
| **P0** | Enable HSTS | S | High | Uncomment Nginx header |
| **P1** | Security logging | M | High | Add structured logging |
| **P1** | Docker non-root user | S | Medium | Add USER directive |
| **P1** | Token refresh | L | Medium | Implement refresh tokens |
| **P2** | Restrict CORS methods | S | Low | Change to whitelist |
| **P2** | Password policy | M | Medium | Add strength validation |
| **P2** | CSP hardening | M | Medium | Remove unsafe-inline |

**Effort**: S=Small (<4h), M=Medium (1-2d), L=Large (1w+)

---

## Conclusion

The FastAPI backend demonstrates **good security fundamentals** (SQL injection protection, password hashing, JWT auth) but has **critical gaps** in:
1. Rate limiting (DoS/brute-force protection)
2. Security monitoring and logging
3. Input validation
4. Production hardening (HSTS, secrets enforcement)

**Overall Assessment**: The API is **not production-ready** without addressing P0 findings. Implementing rate limiting and security logging should be the **immediate priority**.

**Next Steps**:
1. Implement rate limiting middleware (P0)
2. Enforce `SECRET_KEY` requirement (P0)
3. Add input validation schemas (P0)
4. Enable HSTS in production (P0)
5. Implement security event logging (P1)

---

**End of Backend API Security Review**
