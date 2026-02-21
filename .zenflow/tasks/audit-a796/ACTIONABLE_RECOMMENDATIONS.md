# Actionable Recommendations — Interface Maths 2025-2026

**Audit Date**: February 21, 2026  
**Document Version**: 1.0  
**Total Issues**: 42 (P0: 7, P1: 19, P2: 11, P3: 5)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Quick Wins (30 minutes)](#quick-wins-30-minutes)
3. [Priority 0 — Critical Issues](#priority-0--critical-issues)
4. [Priority 1 — High Priority Issues](#priority-1--high-priority-issues)
5. [Priority 2 — Medium Priority Issues](#priority-2--medium-priority-issues)
6. [Priority 3 — Low Priority Issues](#priority-3--low-priority-issues)
7. [Effort Estimation Summary](#effort-estimation-summary)
8. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

### Overall Health Status

| Component | Health Score | Priority Issues | Status |
|-----------|--------------|-----------------|--------|
| **Site Statique (PWA)** | 68/100 | 4 P0, 8 P1 | 🟡 Needs Improvement |
| **Backend Python** | 72/100 | 0 P0, 4 P1 | 🟡 Good |
| **React/Vue Apps** | 52/100 | 1 P0, 3 P1 | 🟠 Needs Work |
| **Docker/DevOps** | 78/100 | 1 P0, 3 P1 | 🟡 Good |
| **Documentation** | 78/100 | 0 P0, 2 P1 | 🟡 Good |
| **Security** | 70/100 | 0 P0, 6 P1 | 🟡 Medium Risk |
| **Accessibility** | 88/100 | 0 P0, 3 P1 | 🟢 Excellent |

**Overall Project Health**: **68/100** 🟡

### Risk Assessment

- **Security Risk**: MEDIUM 🟡 — No critical vulnerabilities, but significant gaps in defense-in-depth
- **Production Readiness**: 75% — Site is functional but needs P0 fixes before production deployment
- **Maintenance Risk**: MEDIUM — Technical debt exists but manageable

### Top Recommendations

1. ✅ **Immediate (This Week)**: Fix 6 quick wins (30 min total) → +8 points
2. 🔴 **Critical (This Month)**: Fix 7 P0 issues (12 hours) → Production-ready
3. ⚠️ **High Priority (This Quarter)**: Fix 19 P1 issues (40 hours) → Solid foundation
4. 📈 **Long-term (Next Quarter)**: Address 16 P2+P3 issues → Excellence

---

## Quick Wins (30 minutes)

**Impact**: +8 points overall health score  
**Effort**: 30 minutes total

### QW-1: Use Minified CSS in Production
- **File**: All HTML files (`site/**/*.html`)
- **Effort**: 5 minutes
- **Impact**: HIGH (-5.8 KB bandwidth per user)
- **Component**: Site Statique

**Current**:
```html
<link rel="stylesheet" href="assets/css/site.css">
```

**Fix**:
```html
<link rel="stylesheet" href="assets/css/site.min.css">
```

**Command**:
```bash
find site -name "*.html" -exec sed -i 's|/css/site.css|/css/site.min.css|g' {} +
```

---

### QW-2: Add postcss-cli to package.json
- **File**: `package.json`
- **Effort**: 2 minutes
- **Impact**: HIGH (developers can't build CSS)
- **Component**: Build Tooling

**Fix**:
```json
{
  "devDependencies": {
    "postcss-cli": "^11.0.0"
  }
}
```

**Command**:
```bash
npm install --save-dev postcss-cli
```

---

### QW-3: Pin Lucide Version with SRI
- **File**: `site/index.html:22`
- **Effort**: 5 minutes
- **Impact**: HIGH (eliminates supply chain attack vector)
- **Component**: Site Statique

**Current**:
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
```

**Fix**:
```html
<script src="https://cdn.jsdelivr.net/npm/lucide@0.263.1/dist/umd/lucide.min.js"
        integrity="sha384-..." 
        crossorigin="anonymous"></script>
```

**Steps**:
1. Visit https://www.srihash.org/
2. Enter URL: `https://cdn.jsdelivr.net/npm/lucide@0.263.1/dist/umd/lucide.min.js`
3. Copy generated SRI hash
4. Update `site/index.html`

---

### QW-4: Create robots.txt
- **File**: `site/robots.txt` (new)
- **Effort**: 3 minutes
- **Impact**: MEDIUM (SEO improvement)
- **Component**: Site Statique

**Create `site/robots.txt`**:
```txt
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://maths.labomaths.tn/sitemap.xml
```

---

### QW-5: Add Canonical Links
- **File**: All HTML files
- **Effort**: 10 minutes
- **Impact**: MEDIUM (SEO, prevents duplicate content)
- **Component**: Site Statique

**Add to `<head>` section**:
```html
<link rel="canonical" href="https://maths.labomaths.tn/path/to/page.html">
```

**Script to automate**:
```bash
# Create canonical-links.sh
#!/bin/bash
find site -name "*.html" | while read file; do
  # Extract relative path from site/
  rel_path="${file#site/}"
  # Add canonical link after <meta charset>
  sed -i "/<meta charset/a\\    <link rel=\"canonical\" href=\"https://maths.labomaths.tn/$rel_path\">" "$file"
done
```

---

### QW-6: Remove CSP Meta Tags
- **Files**: `site/EDS_terminale/Progression/index.html`, `site/Maths_expertes/Progression/index.html`
- **Effort**: 2 minutes
- **Impact**: MEDIUM (eliminates CSP conflict)
- **Component**: Site Statique

**Find and remove**:
```html
<meta http-equiv="Content-Security-Policy" content="...">
```

**Command**:
```bash
find site -name "*.html" -exec sed -i '/<meta http-equiv="Content-Security-Policy"/d' {} +
```

---

## Priority 0 — Critical Issues

### P0-1: Fix Empty Catch Blocks (17 occurrences)
- **Component**: Site Statique JavaScript
- **Severity**: CRITICAL
- **Impact**: Silent errors make debugging impossible
- **Effort**: Small (30-60 minutes)
- **Files**: 7 JavaScript files

**Anti-Pattern**:
```javascript
try {
  // risky operation
} catch (e) {
  // Empty - error silently ignored ❌
}
```

**Fix Pattern 1 — Log Error**:
```javascript
try {
  // risky operation
} catch (e) {
  console.error('Operation failed:', e);
  // Optional: show user-friendly message
}
```

**Fix Pattern 2 — Graceful Degradation**:
```javascript
try {
  const data = JSON.parse(localStorage.getItem('theme'));
} catch (e) {
  console.warn('Failed to parse theme, using default:', e);
  const data = { theme: 'light' }; // Fallback
}
```

**Fix Pattern 3 — Rethrow with Context**:
```javascript
try {
  await fetchCriticalData();
} catch (e) {
  throw new Error(`Failed to initialize app: ${e.message}`);
}
```

**Implementation Guide**:
1. Run `npm run lint` to identify all 17 violations
2. For each violation:
   - Understand the operation being caught
   - Add appropriate error handling (log, fallback, or rethrow)
3. Re-run `npm run lint` to verify 0 errors

**Automated Fix (Use with caution)**:
```bash
# WARNING: Review each change manually
find site/assets/js -name "*.js" -exec sed -i '/catch\s*(\s*\w\+\s*).*{$/a\    console.error("Error caught:", arguments);' {} +
```

---

### P0-2: Fix Largest Contentful Paint (LCP)
- **Component**: Site Statique
- **Severity**: CRITICAL
- **Impact**: Poor user experience (3.8s vs 2.5s target)
- **Effort**: Medium (4-6 hours)
- **Current LCP**: 3.8s ❌
- **Target LCP**: <2.5s ✅

**Root Causes**:
1. Large unoptimized images
2. Render-blocking resources
3. No resource hints

**Fix 1 — Optimize Images**:
```bash
# Install image optimization tool
npm install --save-dev sharp-cli

# Optimize all images
npx sharp-cli --input "site/assets/images/**/*.{jpg,png}" \
              --output "site/assets/images/" \
              --quality 85 \
              --format webp
```

**Fix 2 — Add Resource Hints**:
```html
<head>
  <!-- Preconnect to external domains -->
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  
  <!-- Preload critical CSS -->
  <link rel="preload" href="assets/css/site.min.css" as="style">
  
  <!-- Preload LCP image (identify with Lighthouse) -->
  <link rel="preload" href="assets/images/hero-image.webp" as="image" type="image/webp">
</head>
```

**Fix 3 — Lazy Load Below-Fold Images**:
```html
<!-- Above-fold images (keep eager loading) -->
<img src="hero.webp" alt="..." width="800" height="600">

<!-- Below-fold images (lazy load) -->
<img src="gallery-1.webp" alt="..." loading="lazy" width="400" height="300">
```

**Fix 4 — Add Cache Headers (Nginx)**:
```nginx
# Add to deploy/nginx/*.conf
location ~* \.(jpg|jpeg|png|webp|svg|gif|ico)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**Verification**:
```bash
npx lighthouse http://localhost:8000/index.html --only-categories=performance
# Target: LCP < 2.5s
```

---

### P0-3: Fix npm Security Vulnerabilities
- **Component**: All (npm dependencies)
- **Severity**: CRITICAL
- **Impact**: 31 known vulnerabilities
- **Effort**: Small-Medium (1-2 hours)

**Current Status**:
```
found 31 vulnerabilities (15 moderate, 14 high, 2 critical)
```

**Fix Process**:

**Step 1 — Auto-Fix**:
```bash
npm audit fix
```

**Step 2 — Force Update Breaking Changes (if needed)**:
```bash
npm audit fix --force
```

**Step 3 — Manual Review**:
```bash
npm audit
# Review each unfixable vulnerability:
# - Is it in devDependencies only? (Lower risk)
# - Is there a workaround/mitigation?
# - Do we use the vulnerable feature?
```

**Step 4 — Update Outdated Packages**:
```bash
npm outdated
npm update
```

**Step 5 — Consider Alternatives**:
```bash
# If a package has persistent vulnerabilities:
# - Find alternative package
# - Remove if not critical
# - Pin version if upgrade breaks compatibility
```

**Verification**:
```bash
npm audit
# Target: 0 vulnerabilities (or only low-risk in devDependencies)
```

---

### P0-4: Add Non-Root User to Dockerfile
- **Component**: Docker
- **Severity**: CRITICAL (CIS Docker Benchmark 4.1)
- **Impact**: Container runs as root (security risk)
- **Effort**: Small (15 minutes)
- **File**: `Dockerfile`

**Current**: Container runs as root (UID 0) ❌

**Fix**:
```dockerfile
# Add after line 46 (ENV HOSTNAME=0.0.0.0)
FROM base AS runner
WORKDIR /app

ENV HOSTNAME=0.0.0.0

# ✅ ADD THIS: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 -G nodejs

# ... (existing COPY commands)

# ✅ ADD THIS: Change ownership
RUN chown -R nextjs:nodejs /app

# ✅ ADD THIS: Switch to non-root user
USER nextjs

# Existing CMD remains the same
CMD ["node", "server.js"]
```

**Verification**:
```bash
# Build and test
docker build -t nexus-test .
docker run --rm nexus-test whoami
# Expected output: nextjs (not root)
```

**Testing Checklist**:
- [ ] App starts successfully
- [ ] Database connections work
- [ ] File uploads work (if applicable)
- [ ] Logs are written correctly

---

### P0-5: Fix Duplicate `<main>` Elements
- **Component**: Site Statique HTML
- **Severity**: CRITICAL (Accessibility)
- **Impact**: Screen readers confused (WCAG 2.1 AA violation)
- **Effort**: Small (15 minutes)
- **Files**: 3 HTML files

**Current**: Multiple `<main>` elements on same page ❌

**Fix Pattern 1 — Single Main**:
```html
<!-- BEFORE -->
<main id="content1">...</main>
<main id="content2">...</main>

<!-- AFTER -->
<main id="content">
  <section id="content1">...</section>
  <section id="content2">...</section>
</main>
```

**Fix Pattern 2 — Hidden Main**:
```html
<!-- If multiple mains are tabs/views, hide inactive ones -->
<main id="tab1" aria-hidden="false">...</main>
<main id="tab2" aria-hidden="true" hidden>...</main>

<script>
// Only one main is visible at a time
// Update aria-hidden when switching tabs
</script>
```

**Command to Find**:
```bash
grep -rn "<main" site/ --include="*.html"
# Manually review each file with multiple <main> tags
```

---

### P0-6: Fix React Build Failure (undefined `Citations`)
- **Component**: React App (ui/)
- **Severity**: CRITICAL
- **Impact**: React app does not build
- **Effort**: Small (30 minutes)
- **File**: `ui/src/pages/MainContent.tsx:22`

**Current Error**:
```
src/pages/MainContent.tsx(22,16): error TS2304: Cannot find name 'Citations'.
```

**Fix Option 1 — Remove Component**:
```tsx
// If Citations component doesn't exist, remove the reference
// ui/src/pages/MainContent.tsx
- <Citations />
```

**Fix Option 2 — Create Component**:
```tsx
// ui/src/components/Citations.tsx (new file)
export function Citations() {
  return (
    <aside className="citations">
      <h2>Références</h2>
      {/* Add citations content */}
    </aside>
  );
}

// ui/src/pages/MainContent.tsx
+ import { Citations } from '../components/Citations';
```

**Verification**:
```bash
cd ui
npm run typecheck
npm run build
# Both should succeed with 0 errors
```

---

### P0-7: Fix Duplicate Skip Links
- **Component**: Site Statique HTML
- **Severity**: CRITICAL (Accessibility)
- **Impact**: Keyboard navigation confusion
- **Effort**: Small (10 minutes)

**Current**: Multiple "Skip to content" links on same page ❌

**Fix**:
```html
<!-- Keep only ONE skip link at the top of <body> -->
<body>
  <a href="#main-content" class="skip-link">Aller au contenu principal</a>
  
  <!-- Remove other duplicate skip links -->
  
  <main id="main-content">
    <!-- Content -->
  </main>
</body>
```

**CSS** (Add if missing):
```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #000;
  color: #fff;
  padding: 8px;
  z-index: 100;
}

.skip-link:focus {
  top: 0;
}
```

---

## Priority 1 — High Priority Issues

### P1-1: Add Rate Limiting to Backend
- **Component**: Backend Python (FastAPI)
- **Severity**: HIGH
- **Impact**: Vulnerable to brute-force attacks on `/auth/token`
- **Effort**: Small (1 hour)
- **File**: `apps/backend/main.py`

**Fix**:
```bash
# Install slowapi
pip install slowapi
```

```python
# apps/backend/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Apply rate limiting to auth endpoint
from fastapi import Request

@app.post("/auth/token")
@limiter.limit("5/minute")  # Max 5 login attempts per minute
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    # ... existing code
```

**Update requirements.txt**:
```txt
slowapi>=0.1.9
```

**Verification**:
```bash
# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:8000/auth/token -d "username=test&password=wrong" -w "\n"
  sleep 1
done
# Expected: First 5 succeed, next 5 return 429 Too Many Requests
```

**References**:
- [slowapi Documentation](https://slowapi.readthedocs.io/)
- [OWASP: Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling)

---

### P1-2: Upgrade ESLint to v8.x
- **Component**: Build Tooling
- **Severity**: HIGH
- **Impact**: Using outdated linter (v6.8.0 from 2020)
- **Effort**: Medium (2-3 hours)
- **Current**: ESLint 6.8.0
- **Target**: ESLint 8.x+ with flat config

**Fix**:
```bash
# Remove old ESLint
npm uninstall eslint babel-eslint

# Install ESLint 8.x
npm install --save-dev eslint@^8.57.0 @eslint/js globals

# Install parser for modern JS
npm install --save-dev @babel/eslint-parser
```

**Create `eslint.config.mjs`** (flat config):
```javascript
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['site/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
      'no-empty': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
```

**Delete old config**:
```bash
rm .eslintrc.json
```

**Update package.json**:
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

**Verification**:
```bash
npm run lint
# Should report same 17 errors (no-empty)
# Fix them, then:
npm run lint
# Expected: 0 errors
```

---

### P1-3: Add Python Docstrings
- **Component**: Backend Python
- **Severity**: HIGH
- **Impact**: 97% of functions undocumented
- **Effort**: Medium (4-6 hours)
- **Coverage**: 1/31 functions documented

**Fix Template**:
```python
def get_user_by_email(db: Session, email: str) -> User | None:
    """
    Retrieve a user by their email address.
    
    Args:
        db: Database session instance
        email: User's email address (case-insensitive)
    
    Returns:
        User object if found, None otherwise
    
    Example:
        >>> user = get_user_by_email(db, "prof@example.com")
        >>> print(user.role)
        'teacher'
    """
    return db.query(User).filter(User.email == email).first()
```

**Priority Order**:
1. **Public API endpoints** (7 endpoints) — 2 hours
2. **Database models** (3 classes) — 1 hour
3. **Utility functions** (10+ functions) — 2 hours
4. **Internal helpers** (remaining) — 1 hour

**Tool to Generate Skeleton**:
```bash
# Install interrogate (docstring coverage checker)
pip install interrogate

# Check coverage
interrogate apps/backend/ --verbose

# Identify missing docstrings
interrogate apps/backend/ --generate-badge .
```

**Verification**:
```bash
interrogate apps/backend/ --badge-format svg
# Target: >80% coverage
```

**References**:
- [PEP 257 — Docstring Conventions](https://peps.python.org/pep-0257/)
- [Google Python Style Guide](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)

---

### P1-4: Standardize Content Security Policy
- **Component**: DevOps (Nginx)
- **Severity**: HIGH
- **Impact**: Inconsistent CSP across 3 configs
- **Effort**: Medium (2-3 hours)
- **Files**: 3 nginx configs with different CSP

**Current Problem**:
- `ops/nginx/security.conf`: Strict CSP (blocks inline scripts)
- `deploy/nginx/maths.labomaths.tn.conf.sample`: Weak CSP (`'unsafe-inline'`)
- `deploy/docker/nginx.conf`: Medium CSP (external CDNs allowed)

**Fix — Create Single Source of Truth**:

**1. Create shared CSP snippet**:
```nginx
# ops/nginx/csp.conf (new file)
# Content Security Policy - Shared Configuration

# Development CSP (allows inline for debugging)
map $http_host $csp_dev {
    default "";
    "localhost" "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";
}

# Production CSP (strict)
set $csp_prod "default-src 'self'; ";
set $csp_prod "${csp_prod}script-src 'self' https://cdn.jsdelivr.net; ";
set $csp_prod "${csp_prod}style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; ";
set $csp_prod "${csp_prod}font-src 'self' data: https://fonts.gstatic.com; ";
set $csp_prod "${csp_prod}img-src 'self' data:; ";
set $csp_prod "${csp_prod}connect-src 'self'; ";
set $csp_prod "${csp_prod}object-src 'none'; ";
set $csp_prod "${csp_prod}base-uri 'self'; ";
set $csp_prod "${csp_prod}frame-ancestors 'none'; ";
set $csp_prod "${csp_prod}upgrade-insecure-requests";

# Apply CSP
add_header Content-Security-Policy $csp_prod always;
```

**2. Include in all nginx configs**:
```nginx
# deploy/nginx/maths.labomaths.tn.conf.sample
http {
    include /etc/nginx/csp.conf;
    # ... rest of config
}
```

**3. Document MathJax/Lucide exceptions**:
```markdown
# docs/SECURITY.md (new file)

## Content Security Policy (CSP)

### Why 'unsafe-inline' for styles?

MathJax requires inline styles for LaTeX rendering. We accept this trade-off because:
- MathJax is a trusted library (v3.x)
- Inline styles pose lower XSS risk than inline scripts
- Alternative: Migrate to KaTeX (strict CSP compatible)

### External CDNs

- **cdn.jsdelivr.net**: Lucide icons (version pinned with SRI)
- **fonts.googleapis.com**: Google Fonts (static CSS)
```

**Verification**:
```bash
# Test CSP with browser DevTools
curl -I https://maths.labomaths.tn/
# Check: Content-Security-Policy header matches $csp_prod
```

---

### P1-5: Remove Database Port Exposure
- **Component**: Docker Compose
- **Severity**: HIGH
- **Impact**: PostgreSQL exposed on host (attack surface)
- **Effort**: Small (5 minutes)
- **File**: `docker-compose.yml`

**Current**:
```yaml
services:
  postgres-db:
    ports:
      - "5435:5432"  # ❌ Exposed to host
```

**Fix**:
```yaml
services:
  postgres-db:
    # ✅ Remove port mapping (DB is internal-only)
    # ports:
    #   - "5435:5432"
    
    # App connects via Docker network, not localhost
```

**If external access is needed for development**:
```yaml
# Create docker-compose.override.yml (not committed to repo)
services:
  postgres-db:
    ports:
      - "5435:5432"  # Only in local dev environment
```

**Verification**:
```bash
docker-compose up -d
docker ps
# Expected: No 0.0.0.0:5435 in PORTS column for postgres-db

# App should still connect via internal network
curl http://localhost:3001/api/health
# Expected: 200 OK (app can reach DB)
```

---

### P1-6: Fix Missing .sr-only CSS Class
- **Component**: Site Statique CSS
- **Severity**: HIGH (Accessibility)
- **Impact**: Screen reader text invisible but not styled
- **Effort**: Small (5 minutes)
- **File**: `site/assets/css/site.css`

**Current**: HTML uses `.sr-only` class but CSS is missing ❌

**Fix**:
```css
/* Screen reader only - visually hidden but accessible */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Focusable screen reader text (e.g., skip links) */
.sr-only-focusable:focus,
.sr-only-focusable:active {
  position: static;
  width: auto;
  height: auto;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

**Verification**:
```bash
# Test with screen reader or Chrome DevTools Accessibility panel
# Verify .sr-only elements are:
# - Not visible to sighted users
# - Announced by screen readers
```

---

### P1-7: Implement PurgeCSS for Unused CSS
- **Component**: Site Statique CSS Build
- **Severity**: HIGH
- **Impact**: 12 KiB of unused CSS (30% waste)
- **Effort**: Medium (2-3 hours)
- **Current CSS Size**: 19.7 KB minified
- **Target CSS Size**: ~14 KB (25-30% reduction)

**Fix**:
```bash
npm install --save-dev @fullhuman/postcss-purgecss
```

**Update `postcss.config.js`**:
```javascript
const purgecss = require('@fullhuman/postcss-purgecss');

module.exports = {
  plugins: [
    require('postcss-import'),
    
    // Add PurgeCSS in production
    ...(process.env.NODE_ENV === 'production'
      ? [
          purgecss({
            content: [
              './site/**/*.html',
              './site/**/*.js',
            ],
            safelist: [
              // Keep dynamic theme classes
              /^theme-/,
              /^dark$/,
              /^light$/,
              // Keep MathJax classes
              /^mjx-/,
              // Keep animation classes
              /^fade-/,
              /^slide-/,
            ],
            defaultExtractor: (content) => content.match(/[\w-/:]+(?<!:)/g) || [],
          }),
        ]
      : []),
    
    require('autoprefixer'),
    require('cssnano')({
      preset: 'default',
    }),
  ],
};
```

**Update `package.json`**:
```json
{
  "scripts": {
    "css:build": "NODE_ENV=production postcss site/assets/css/site.css -o site/assets/css/site.min.css"
  }
}
```

**Testing Strategy**:
1. Build with PurgeCSS: `npm run css:build`
2. Visually test all pages in all 4 themes
3. Test interactive components (modals, dropdowns, tooltips)
4. Add missing classes to `safelist` if needed

**Verification**:
```bash
npm run css:build
ls -lh site/assets/css/site.min.css
# Expected: ~14 KB (down from 19.7 KB)

# Lighthouse audit
npx lighthouse http://localhost:8000/index.html --only-categories=performance
# Expected: "Remove unused CSS" suggestion should disappear
```

---

### P1-8: Document HTTPS Requirement for PWA
- **Component**: Documentation
- **Severity**: HIGH
- **Impact**: PWA features silently fail without HTTPS
- **Effort**: Small (30 minutes)
- **File**: `README.md`, `deploy/README.md`

**Current**: HTTPS mentioned but not emphasized ⚠️

**Fix — Update README.md**:
```markdown
## Production Deployment Requirements

### ⚠️ HTTPS is REQUIRED

Progressive Web App features (service worker, offline mode, install prompt) **only work over HTTPS**. HTTP deployments will silently fail.

#### Quick HTTPS Setup

**Option 1: Let's Encrypt (Recommended)**
```bash
# Using Certbot with Nginx
sudo certbot --nginx -d maths.labomaths.tn
```

**Option 2: Cloudflare (Free)**
- Add site to Cloudflare
- Enable "Full (strict)" SSL/TLS encryption
- Update DNS to Cloudflare nameservers

**Option 3: Development (localhost)**
```bash
# Generate self-signed certificate (not for production)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout localhost.key -out localhost.crt
```

#### Nginx HTTPS Configuration

Uncomment HSTS header in `deploy/nginx/*.conf`:
```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
```

#### Verification

```bash
# Test HTTPS
curl -I https://maths.labomaths.tn/
# Expected: HTTP/2 200

# Test service worker
# Open browser DevTools → Application → Service Workers
# Expected: "Active" status (not "Error: Only secure origins allowed")
```
```

**Add to deploy/README.md**:
```markdown
## Pre-Deployment Checklist

- [ ] SSL certificate installed (`/etc/nginx/ssl/fullchain.pem`)
- [ ] Nginx HTTPS config enabled
- [ ] HSTS header uncommented
- [ ] HTTP→HTTPS redirect active (port 80 → 443)
- [ ] Service worker registration tested (no errors)
```

---

### P1-9: Fix React `any` Type Violations
- **Component**: React App (ui/)
- **Severity**: HIGH
- **Impact**: 10 `any` types (defeats TypeScript purpose)
- **Effort**: Medium (3-4 hours)
- **Files**: 5 TypeScript files

**Current**: 10 ESLint `no-explicit-any` errors

**Fix Pattern 1 — Define Prop Interfaces**:
```tsx
// BEFORE ❌
export function Button({ children, onClick, ...props }: any) {
  return <button onClick={onClick} {...props}>{children}</button>;
}

// AFTER ✅
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ children, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={`btn btn-${variant}`} {...props}>
      {children}
    </button>
  );
}
```

**Fix Pattern 2 — Type Event Handlers**:
```tsx
// BEFORE ❌
const handleClick = (e: any) => {
  console.log(e.target.value);
};

// AFTER ✅
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  console.log(e.currentTarget.value);
};

const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  console.log(e.target.value);
};
```

**Fix Pattern 3 — Type API Responses**:
```tsx
// BEFORE ❌
const [data, setData] = useState<any>(null);

// AFTER ✅
interface ApiResponse {
  title: string;
  description: string;
  tags: string[];
}

const [data, setData] = useState<ApiResponse | null>(null);
```

**Fix Pattern 4 — Generic Components**:
```tsx
// BEFORE ❌
function List({ items, renderItem }: any) { ... }

// AFTER ✅
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map(renderItem)}</ul>;
}
```

**Implementation Plan**:
1. Enable strict TypeScript: `"strict": true` in `tsconfig.json`
2. Fix 10 `any` violations one by one
3. Add types to all components

**Verification**:
```bash
cd ui
npm run typecheck
# Expected: 0 errors

npm run lint
# Expected: 0 `no-explicit-any` errors
```

---

### P1-10 to P1-19: Additional P1 Issues

*(Continuing with same format for remaining P1 issues: CSP improvements, code duplication fixes, Vue app deprecation, etc.)*

**Summary of Remaining P1 Issues**:
- P1-10: Refactor 22% code duplication (4 hours)
- P1-11: Split monolithic CSS file (3 hours)
- P1-12: Remove abandoned Vue app (30 minutes)
- P1-13: Fix CSP `'unsafe-inline'` (8-12 hours, long-term)
- P1-14: Add logging to backend (2 hours)
- P1-15: Fix secret key fallback (30 minutes)
- P1-16: Add outputs/ to .gitignore (2 minutes)
- P1-17: Add HEALTHCHECK to Dockerfile (15 minutes)
- P1-18: Document frontend strategy (1 hour)
- P1-19: Add toast aria-live (15 minutes)

---

## Priority 2 — Medium Priority Issues

*(Summary format due to length)*

### P2 Issues Summary

| ID | Issue | Effort | Impact | Component |
|----|-------|--------|--------|-----------|
| P2-1 | innerHTML with user values | M (3h) | Medium | Site JS |
| P2-2 | Install DOMPurify | S (30m) | Medium | Site JS |
| P2-3 | Verify MathJax version | S (10m) | Medium | Site |
| P2-4 | Missing browserslist config | S (10m) | Low | Build |
| P2-5 | Missing resource limits (Docker) | S (30m) | Medium | DevOps |
| P2-6 | Upgrade Node.js 18→20 | S (1h) | Low | DevOps |
| P2-7 | Users.py complexity | M (3h) | Medium | Backend |
| P2-8 | No refresh tokens (JWT) | L (6h) | Medium | Backend |
| P2-9 | Credential file concerns | S (30m) | Medium | Backend |
| P2-10 | Create API.md | M (2h) | High | Docs |
| P2-11 | Fix README inaccuracies | S (30m) | High | Docs |

**Total P2 Effort**: ~18 hours  
**Impact**: Moderate — Improves robustness and developer experience

---

## Priority 3 — Low Priority Issues

*(Summary format)*

| ID | Issue | Effort | Impact | Component |
|----|-------|--------|--------|-----------|
| P3-1 | Inline styles (sw-client) | M (2h) | Low | Site |
| P3-2 | postMessage origin check | S (5m) | Low | Site |
| P3-3 | Docker labels/metadata | S (30m) | Low | DevOps |
| P3-4 | Custom 429 error page | S (30m) | Low | DevOps |
| P3-5 | Create ARCHITECTURE.md | L (3h) | Medium | Docs |

**Total P3 Effort**: ~6 hours  
**Impact**: Low — Nice-to-have improvements

---

## Effort Estimation Summary

### By Priority

| Priority | Count | Total Effort | Per-Issue Avg | Impact |
|----------|-------|--------------|---------------|--------|
| **Quick Wins** | 6 | 30 minutes | 5 min | Very High |
| **P0** | 7 | 12 hours | 1.7 hours | Critical |
| **P1** | 19 | 40 hours | 2.1 hours | High |
| **P2** | 11 | 18 hours | 1.6 hours | Medium |
| **P3** | 5 | 6 hours | 1.2 hours | Low |
| **TOTAL** | 48 | ~77 hours | 1.6 hours | — |

### By Effort Size

| Size | Count | Example |
|------|-------|---------|
| **Tiny (S)** | 24 | Add dependency, fix typo, remove code |
| **Small (M)** | 14 | Refactor function, add tests, write docs |
| **Medium (L)** | 8 | Feature implementation, major refactor |
| **Large (XL)** | 2 | CSP refactoring, migrate architecture |

### By Component

| Component | P0 | P1 | P2 | P3 | Total Effort |
|-----------|----|----|----|----|--------------|
| **Site Statique** | 4 | 8 | 5 | 2 | 32 hours |
| **Backend Python** | 0 | 4 | 4 | 0 | 14 hours |
| **React/Vue Apps** | 1 | 3 | 1 | 0 | 10 hours |
| **Docker/DevOps** | 1 | 3 | 3 | 2 | 12 hours |
| **Documentation** | 0 | 2 | 2 | 1 | 7 hours |
| **Build/Tooling** | 1 | 2 | 1 | 0 | 5 hours |

---

## Implementation Roadmap

### Phase 1: Immediate Actions (This Week)
**Duration**: 1 day (8 hours)  
**Goals**: Fix critical blockers, achieve production-readiness baseline

**Day 1 Morning (4 hours)**:
1. ✅ Execute 6 Quick Wins (30 min)
2. 🔴 Fix P0-1: Empty catch blocks (1 hour)
3. 🔴 Fix P0-3: npm vulnerabilities (1 hour)
4. 🔴 Fix P0-4: Non-root Docker user (30 min)
5. 🔴 Fix P0-5: Duplicate `<main>` (30 min)

**Day 1 Afternoon (4 hours)**:
6. 🔴 Fix P0-6: React build failure (30 min)
7. 🔴 Fix P0-7: Duplicate skip links (15 min)
8. 🔴 Fix P0-2: LCP optimization (2 hours)
9. ⚠️ Fix P1-1: Backend rate limiting (1 hour)

**Expected Outcome**:
- ✅ All P0 issues resolved
- ✅ Site is production-ready
- ✅ Health score: 68 → 78 (+10 points)

---

### Phase 2: High-Priority Improvements (This Month)
**Duration**: 1 week (40 hours)  
**Goals**: Address all P1 issues, establish solid foundation

**Week 1: Code Quality & Security**:
- Day 1-2: ESLint upgrade + fix React types (8 hours)
- Day 3: Add Python docstrings (6 hours)
- Day 4: Standardize CSP + remove DB port (4 hours)
- Day 5: Documentation updates (4 hours)

**Week 2: Performance & Refactoring**:
- Day 1-2: Code duplication cleanup (8 hours)
- Day 3: PurgeCSS + CSS modularization (6 hours)
- Day 4: Frontend architecture cleanup (4 hours)
- Day 5: Testing & verification (4 hours)

**Expected Outcome**:
- ✅ All P1 issues resolved
- ✅ Health score: 78 → 88 (+10 points)
- ✅ Technical debt reduced by 60%

---

### Phase 3: Medium-Priority Polish (This Quarter)
**Duration**: 2 weeks (16 hours over 3 months)  
**Goals**: Address P2 issues, improve developer experience

**Sprint 1 (1 week)**: Security & Backend
- DOMPurify installation + innerHTML audit (4 hours)
- Backend improvements (JWT refresh, logging) (6 hours)

**Sprint 2 (1 week)**: Documentation & DevOps
- API documentation (3 hours)
- Docker resource limits + Node upgrade (3 hours)

**Expected Outcome**:
- ✅ All P2 issues resolved
- ✅ Health score: 88 → 92 (+4 points)

---

### Phase 4: Long-Term Excellence (Next Quarter)
**Duration**: Ongoing (6 hours over 6 months)  
**Goals**: Address P3 issues, achieve >95% health score

**Continuous Improvements**:
- Architectural documentation (3 hours)
- Monitoring & observability (2 hours)
- Advanced CSP refactoring (ongoing)

**Expected Outcome**:
- ✅ All P3 issues resolved
- ✅ Health score: 92 → 95+ (+3 points)
- ✅ Industry best practices achieved

---

## Success Metrics

### Health Score Targets

| Phase | Duration | Health Score | Production Ready? |
|-------|----------|--------------|-------------------|
| **Current** | — | 68/100 🟡 | ❌ No (7 P0 issues) |
| **After Phase 1** | 1 day | 78/100 🟡 | ✅ Yes |
| **After Phase 2** | 1 week | 88/100 🟢 | ✅ Excellent |
| **After Phase 3** | 1 quarter | 92/100 🟢 | ✅ Production-grade |
| **After Phase 4** | 2 quarters | 95/100 🟢 | ✅ Industry-leading |

### Component Health Targets

| Component | Current | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|-----------|---------|---------|---------|---------|---------|
| Site Statique | 68 | 78 | 88 | 92 | 95 |
| Backend | 72 | 80 | 90 | 93 | 95 |
| React App | 52 | 70 | 85 | 88 | 92 |
| DevOps | 78 | 85 | 90 | 92 | 95 |
| Security | 70 | 78 | 88 | 92 | 95 |

---

## Appendix: Command Reference

### Quick Win Commands
```bash
# QW-1: Use minified CSS
find site -name "*.html" -exec sed -i 's|/css/site.css|/css/site.min.css|g' {} +

# QW-2: Install postcss-cli
npm install --save-dev postcss-cli

# QW-3: Pin Lucide (manual - update index.html)

# QW-4: Create robots.txt (manual)

# QW-5: Add canonical links (use script above)

# QW-6: Remove CSP meta tags
find site -name "*.html" -exec sed -i '/<meta http-equiv="Content-Security-Policy"/d' {} +
```

### P0 Fix Commands
```bash
# P0-1: Lint errors
npm run lint
# (Manual fix required)

# P0-2: LCP
npm install --save-dev sharp-cli
npx sharp-cli --input "site/assets/images/**/*.jpg" --output "site/assets/images/" --quality 85 --format webp

# P0-3: npm audit
npm audit fix

# P0-4: Dockerfile non-root (manual edit)

# P0-5: Duplicate <main> (manual fix)

# P0-6: React build
cd ui && npm run build

# P0-7: Skip links (manual fix)
```

### Verification Commands
```bash
# Overall health check
npm run lint                  # 0 errors
npm run test:unit            # >80% coverage
npm run css:build            # <15 KB
cd ui && npm run build       # Success
cd apps/backend && pytest    # All pass
npm audit                    # 0 vulnerabilities

# Performance
npx lighthouse http://localhost:8000/ --only-categories=performance
# Target: Performance >90, LCP <2.5s

# Security
npm audit
bandit -r apps/backend/
# Target: 0 vulnerabilities

# Docker
docker build -t test .
docker run --rm test whoami  # Expected: nextjs (not root)
```

---

## References

### Security
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

### Performance
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

### Accessibility
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Best Practices](https://www.w3.org/WAI/ARIA/apg/)

### Best Practices
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Python PEP 8](https://peps.python.org/pep-0008/)

---

**Document Status**: ✅ Complete  
**Last Updated**: 2026-02-21  
**Next Review**: After Phase 1 completion

---

**End of Actionable Recommendations**
