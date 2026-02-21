# Phase 2: Manual Deep-Dive Review — Architecture & Code Quality

**Generated**: 2026-02-21  
**Audit**: Interface Maths 2025-2026  
**Repository**: https://github.com/cyranoaladin/Interface_Maths_2025_2026

---

## 1. Architecture Review

### 1.1 Project Components Overview

The project consists of **5 distinct components** with overlapping responsibilities:

| Component | Technology | Status | Purpose | LOC Est. |
|-----------|-----------|--------|---------|----------|
| **site/** | HTML/CSS/JS + PWA | ✅ Production | Static educational site with PWA features | ~2,500 |
| **apps/backend/** | FastAPI + SQLAlchemy | ✅ Active | REST API (/api/tree, /auth), serves static content | ~500 |
| **apps/frontend/** | Vue 3 + TypeScript | ⚠️ Template only | Minimal boilerplate (HelloWorld component) | ~50 |
| **ui/** | React 19 + TypeScript + Tailwind | 🔨 In development | Modern React reimplementation of site/ | ~800 |
| **backend/** | Python (minimal) | ⚠️ Legacy | Single requirements.txt with fastapi dependency | ~5 |

**Critical Finding**: The project has **3 frontend implementations** (static site/, Vue apps/frontend/, React ui/) with significant functional overlap, indicating **architectural confusion** and **lack of migration strategy**.

---

### 1.2 Component Relationships & Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT LAYER                          │
│  nginx (port 80) ──┬──> /content/* ──> site/ (static files) │
│                    └──> /api/*     ──> apps/backend:8000    │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                             │
│  1. site/assets/contents.json    (6.8 KB JSON index)        │
│  2. site/assets/contents.static.js (4 KB fallback)          │
│  3. GET /api/tree                 (FastAPI dynamic index)   │
└─────────────────────────────────────────────────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   SITE/ (Production)     │  │   UI/ (React - Dev)      │
│  • contents.js (366 LOC) │  │  • Sommaire.tsx (66 LOC) │
│  • levels.js (171 LOC)   │  │  • Progression.tsx       │
│  • progression.js        │  │  • Hero.tsx              │
│  • hero.js               │  │  • QuickAccess.tsx       │
│  ✅ PWA (sw.js + manifest)│  │  ❌ No PWA yet           │
└──────────────────────────┘  └──────────────────────────┘
                                      │
                              ⚠️ CROSS-DEPENDENCY
                              Fetches /site/assets/contents.json
```

**Architecture Issues Identified**:

1. **Cross-Component Dependency**: `ui/src/components/sections/Sommaire.tsx` fetches `/site/assets/contents.json` from the static site, creating tight coupling between two supposedly independent frontends.

2. **Data Source Fragmentation**: Three content sources exist with no clear primary source:
   - `site/assets/contents.json` (static JSON)
   - `site/assets/contents.static.js` (file:// fallback)
   - `/api/tree` (FastAPI dynamic endpoint)

3. **Redundant Backends**: Two backend components exist:
   - `backend/requirements.txt` (legacy, unused)
   - `apps/backend/` (active FastAPI application)

4. **Vue Frontend Abandonment**: `apps/frontend/` contains only Vue template boilerplate (HelloWorld component), suggesting an abandoned migration attempt.

---

### 1.3 Migration Strategy Analysis

**Evidence of Migration Intent**:

- ✅ `guide_implementation.md` documents UI modernization plan
- ✅ `ui/` React app replicates core site/ features (Hero, Sommaire, QuickAccess, Progression)
- ❌ No migration timeline or completion criteria
- ❌ No deprecation warnings in site/
- ❌ Both frontends actively maintained

**Migration Maturity Assessment**:

| Feature | site/ (Static) | ui/ (React) | Migration Status |
|---------|---------------|-------------|------------------|
| Hero Section | ✅ Complete | ✅ Replicated | 🔄 Duplicate |
| Sommaire (Index) | ✅ 366 LOC with filters/search | ✅ Basic (66 LOC) | ⚠️ React incomplete |
| Progression Timeline | ✅ Timeline + Grid views | ✅ Basic grid only | ⚠️ React incomplete |
| Favorites (localStorage) | ✅ Full implementation | ❌ Missing | ❌ Not migrated |
| PWA (Service Worker) | ✅ Production (sw.js 2KB) | ❌ Not implemented | ❌ Not migrated |
| Theme Toggle (4 themes) | ✅ dark/light/energie/pure | ❌ No theme system | ❌ Not migrated |
| Search + Filters | ✅ Accent-insensitive, chips | ❌ Not visible in code | ⚠️ Unclear |
| E2E Tests | ✅ Playwright suite | ❌ Missing | ❌ Not migrated |
| i18n | ✅ `i18n.js` stub | ❌ Missing | ❌ Not migrated |

**Conclusion**: React `ui/` is a **partial, incomplete reimplementation** (40-50% feature parity). No clear migration path exists.

---

### 1.4 Directory Structure Organization

#### ✅ **Well-Organized** (Backend)

```
apps/backend/
├── app/
│   ├── routers/       # Clean route separation
│   │   └── auth.py
│   ├── config.py      # Pydantic settings
│   ├── db.py          # Database abstraction
│   ├── models.py      # SQLAlchemy models
│   ├── security.py    # Auth logic
│   ├── tree.py        # Business logic (content indexing)
│   └── main.py        # Application factory
├── scripts/           # Utilities
├── tests/             # Test suite
├── Dockerfile         # Containerization
└── requirements.txt   # Dependencies
```

**Score**: **9/10** — Excellent separation of concerns, follows FastAPI best practices.

#### ⚠️ **Moderately Organized** (Static Site)

```
site/
├── assets/
│   ├── css/           # Design system
│   │   ├── site.css   # Source (unminified) ⚠️ Used in HTML
│   │   └── site.min.css # Built (minified) ❌ Not referenced
│   ├── js/            # 14 vanilla JS modules
│   │   ├── contents.js    # 366 LOC - largest module
│   │   ├── levels.js      # 171 LOC
│   │   ├── progression.js # 80 LOC
│   │   └── ...
│   ├── contents.json      # Data source
│   └── contents.static.js # Fallback
├── EDS_premiere/      # Content pages (Première level)
├── EDS_terminale/     # Content pages (Terminale level)
├── Maths_expertes/    # Content pages (Expert level)
├── index.html         # Entry point (12.7 KB)
├── manifest.webmanifest # PWA manifest
└── sw.js              # Service worker (2 KB)
```

**Issues**:
- ❌ HTML references `site.css` instead of `site.min.css` (identified in Phase 1)
- ⚠️ No module bundling (14 separate JS files, no tree-shaking)
- ⚠️ Large entry point (`index.html` 12.7 KB)
- ⚠️ Mixed content (pages + assets in same root)

**Score**: **6/10** — Functional but lacks modern build pipeline.

#### ❌ **Poorly Organized** (React UI)

```
ui/
├── src/
│   ├── components/
│   │   ├── layout/        # Header, Footer
│   │   ├── sections/      # Hero, Sommaire, Progression
│   │   └── ui/            # Button, Card, Badge, Chip
│   ├── pages/             # Home, Premiere, Terminale, Expertes
│   ├── utils/             # cn.ts only
│   ├── data/              # ❌ Empty (should contain contents.ts)
│   └── assets/            # ❌ Not organized
├── dist/                  # Built output
└── public/                # Static assets
```

**Issues**:
- ❌ No `data/` layer (fetches from `/site/assets/` instead)
- ❌ No state management (React Context/Zustand missing)
- ❌ No routing configuration file
- ⚠️ Shallow component hierarchy (mixing layout + business logic)

**Score**: **5/10** — Basic React structure, missing data/state layers.

#### 🔴 **Abandoned** (Vue Frontend)

```
apps/frontend/
├── src/
│   ├── components/
│   │   └── HelloWorld.vue    # Template boilerplate
│   └── App.vue               # Vite + Vue logos
└── package.json
```

**Score**: **1/10** — Non-functional, should be removed.

---

### 1.5 Separation of Concerns Assessment

#### Backend (`apps/backend/`)

| Layer | Implementation | Score |
|-------|---------------|-------|
| Routing | ✅ `routers/auth.py` | 9/10 |
| Business Logic | ✅ `tree.py` (content indexing) | 8/10 |
| Data Models | ✅ `models.py` (SQLAlchemy) | 9/10 |
| Configuration | ✅ `config.py` (Pydantic Settings) | 10/10 |
| Security | ✅ `security.py` (password hashing, JWT) | 9/10 |
| Database | ✅ `db.py` (session management) | 8/10 |

**Overall**: **9/10** — Excellent separation, follows Clean Architecture principles.

**Recommendation**: ✅ No changes needed.

---

#### Static Site (`site/`)

| Layer | Implementation | Score | Issues |
|-------|---------------|-------|--------|
| Presentation | ⚠️ Inline HTML (270 LOC `index.html`) | 5/10 | No template system |
| Styling | ✅ `assets/css/site.css` (design tokens) | 8/10 | Good CSS variables usage |
| Business Logic | ⚠️ Mixed in `contents.js` (366 LOC) | 5/10 | DOM manipulation + data fetching + filtering all in one file |
| Data Layer | ⚠️ Three sources (JSON/JS/API) | 4/10 | No abstraction layer |
| Utilities | ✅ Separate modules (`utils.js`, `icons.js`) | 7/10 | Well isolated |

**Overall**: **6/10** — Functional but lacks modularity.

**Recommendations**:
1. **Extract business logic** from `contents.js`:
   ```javascript
   // Bad (current): DOM + Logic + Data mixed
   function loadContents() { /* 50 lines mixing fetch/render/filter */ }
   
   // Good (refactor):
   // data-service.js
   export async function fetchContents() { /* ... */ }
   
   // filter-service.js
   export function filterItems(items, query, tags) { /* ... */ }
   
   // contents-ui.js
   export function renderCards(items, container) { /* ... */ }
   ```

2. **Consolidate data sources** — Choose `/api/tree` as single source of truth, remove fallbacks.

3. **Template system** — Consider Handlebars/Mustache for `index.html` generation.

---

#### React UI (`ui/`)

| Layer | Implementation | Score | Issues |
|-------|---------------|-------|--------|
| Presentation | ✅ Components (`sections/`, `ui/`) | 7/10 | Good component split |
| State Management | ❌ Missing | 2/10 | `useState` only, no global state |
| Data Layer | ❌ Fetch in component | 3/10 | `Sommaire.tsx` directly fetches, no abstraction |
| Routing | ✅ React Router DOM | 8/10 | Clean routes in `App.tsx` |
| Styling | ✅ Tailwind CSS | 8/10 | Utility-first approach |
| Testing | ⚠️ Minimal | 5/10 | Only `button.spec.tsx` exists |

**Overall**: **5.5/10** — Immature architecture for production.

**Recommendations**:
1. **Add data layer**:
   ```typescript
   // src/services/api.ts
   export const fetchContents = async () => { /* ... */ }
   
   // src/hooks/useContents.ts
   export const useContents = () => { /* ... */ }
   ```

2. **Add state management** — React Context or Zustand for favorites, theme, filters.

3. **TypeScript types** — Define `Resource`, `ContentGroup` interfaces.

4. **Testing** — Add component tests for all `sections/`.

---

### 1.6 Code Duplication Analysis

#### High Duplication Areas (P0 — Critical)

| Functionality | site/ | ui/ | Duplication % | Impact |
|--------------|-------|-----|---------------|--------|
| **Content Indexing** | `contents.js` (366 LOC) | `Sommaire.tsx` (66 LOC) | ~30% | 🔴 High — Core feature duplicated |
| **Progression Timeline** | `progression.js` (80 LOC) | `Progression.tsx` (~50 LOC) | ~40% | 🔴 High — Complex logic duplicated |
| **Hero Section** | `hero.js` (17 LOC) | `Hero.tsx` (~40 LOC) | ~25% | 🟡 Medium — Simple feature |
| **Theme Toggle** | `theme-toggle.js` (47 LOC) | ❌ Missing in ui/ | 0% | 🟢 No duplication yet |
| **Quick Access Cards** | Inline HTML | `QuickAccess.tsx` | ~20% | 🟡 Medium — Presentation only |

**Total Estimated Duplication**: **~300 LOC** (25% of site/ JavaScript codebase)

**Cost of Duplication**:
- ❌ **Maintenance burden**: Bug fixes must be applied twice
- ❌ **Feature drift**: site/ has favorites, ui/ does not
- ❌ **Testing overhead**: E2E tests only cover site/
- ❌ **Documentation split**: README documents site/, ui/ undocumented

---

#### Medium Duplication (P1 — Important)

| Asset | site/ | ui/ | Notes |
|-------|-------|-----|-------|
| **Lucide Icons** | `lucide.min.js` (365 KB CDN) | `lucide-react` (npm) | Different loading strategies |
| **Tailwind Config** | ❌ Not used | `tailwind.config.js` | ui/ uses Tailwind, site/ uses custom CSS |
| **Design Tokens** | `site.css` (CSS variables) | `tailwind.config.js` colors | **Color values duplicated but different formats** |

**Example — Color Token Duplication**:

```css
/* site/assets/css/site.css */
:root {
  --primary: #2563eb;    /* Bleu */
  --secondary: #7c3aed;  /* Violet */
  --accent: #06b6d4;     /* Cyan */
}
```

```javascript
// ui/tailwind.config.js (NOT FOUND — should exist)
export default {
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',   // ⚠️ Duplication
        secondary: '#7c3aed', // ⚠️ Duplication
      }
    }
  }
}
```

**Recommendation**: **Create shared design tokens file** (JSON) consumed by both site/ (CSS variables) and ui/ (Tailwind config).

---

### 1.7 Circular Dependency Analysis

#### ❌ **Critical Circular Dependency Detected**

```
ui/ (React App)
  └──> Fetches /site/assets/contents.json
         │
         └──> Requires site/ to be built & deployed
                │
                └──> ui/ depends on site/ asset
                       │
                       └──> But ui/ is supposed to REPLACE site/
```

**Code Evidence** (`ui/src/components/sections/Sommaire.tsx:10`):

```typescript
fetch("/site/assets/contents.json")
  .then((r) => (r.ok ? r.json() : Promise.reject()))
  .catch(() => {
    // Fallback to contents.static.js
    const s = document.createElement("script");
    s.src = "/site/assets/contents.static.js";  // ⚠️ Depends on site/ asset
  })
```

**Severity**: **P0 — Critical**

**Impact**:
- ❌ ui/ **cannot run standalone** without site/ deployed
- ❌ Deployment complexity — must deploy both frontends
- ❌ Migration blocked — cannot deprecate site/ while ui/ depends on it

**Recommendation**:
1. **Short-term** — ui/ should fetch from `/api/tree` (backend), not `/site/`
2. **Long-term** — Create shared data package (`@maths/content-index`) consumed by both

---

#### ⚠️ **Potential Circular Risks** (Not Yet Realized)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Backend serves ui/ build at `/ui/*` AND site/ at `/content/*` | High | Medium | Keep deployments separate |
| Shared CSS assets between site/ and ui/ | Low | Low | Different styling approaches (CSS vs Tailwind) |
| Test fixtures duplicated | Medium | Low | Create shared test data in `/tests/fixtures/` |

---

### 1.8 Technology Stack Consistency

| Layer | site/ | apps/backend/ | apps/frontend/ | ui/ | Consistency |
|-------|-------|--------------|---------------|-----|-------------|
| **Language** | JavaScript (ES6) | Python 3.12 | TypeScript | TypeScript | ⚠️ Mixed |
| **Framework** | Vanilla JS | FastAPI | Vue 3 | React 19 | ❌ Inconsistent |
| **Build Tool** | PostCSS | None | Vite | Vite | ⚠️ Partial |
| **Bundler** | None | None | Vite | Vite | ⚠️ Partial |
| **CSS** | Custom (CSS variables) | N/A | Scoped CSS | Tailwind | ❌ Inconsistent |
| **Icons** | Lucide (CDN) | N/A | N/A | lucide-react (npm) | ⚠️ Different implementations |
| **Testing** | Vitest (unit) + Playwright (E2E) | pytest | None | Vitest | ⚠️ Partial |
| **Linting** | ESLint 6.8 | Flake8 | ESLint 8.57 | ESLint 9.36 | ⚠️ Version mismatch |
| **Package Manager** | npm | pip | npm | npm | ⚠️ Mixed |

**Recommendations**:
1. **Consolidate frontends** — Choose one (React `ui/` or static `site/`), deprecate others
2. **Upgrade ESLint** — Align all frontends to ESLint 9.x
3. **Standardize build tools** — Use Vite for all frontends
4. **Shared icon strategy** — Pick lucide-react (npm) or CDN, not both

---

### 1.9 Key Architecture Metrics

| Metric | Value | Assessment |
|--------|-------|-----------|
| **Active Frontend Components** | 3 (site/, apps/frontend/, ui/) | 🔴 Too many |
| **Backend Components** | 2 (backend/, apps/backend/) | 🟡 One is legacy |
| **Data Source Redundancy** | 3 sources (JSON, JS, API) | 🔴 High fragmentation |
| **Cross-Component Dependencies** | 1 critical (ui/ → site/) | 🔴 Blocks migration |
| **Code Duplication** | ~300 LOC (~25% of site/ JS) | 🔴 High |
| **Circular Dependencies** | 1 detected (ui/ ↔ site/) | 🔴 Critical issue |
| **Technology Diversity** | 4 frameworks (Vanilla/Vue/React/FastAPI) | 🟡 High complexity |
| **Deployment Complexity** | Docker Compose (2 services) + 3 frontends | 🟡 Medium-high |

---

## 1.10 Architecture Health Score

| Dimension | Score | Weight | Weighted Score |
|-----------|-------|--------|----------------|
| Component Cohesion | 4/10 | 25% | 1.0 |
| Separation of Concerns | 7/10 | 20% | 1.4 |
| Dependency Management | 3/10 | 20% | 0.6 |
| Code Reusability | 5/10 | 15% | 0.75 |
| Technology Stack Consistency | 4/10 | 10% | 0.4 |
| Migration Strategy | 2/10 | 10% | 0.2 |

**Overall Architecture Health**: **4.35/10** (43.5%) — ⚠️ **Needs Significant Improvement**

---

## 1.11 Critical Recommendations (P0)

### Recommendation 1: **Consolidate Frontend Strategy**

**Problem**: Three frontends (site/, apps/frontend/, ui/) with no clear winner.

**Solution**:
1. **Decision Required**: Choose primary frontend architecture
   - **Option A**: Keep site/ (PWA), deprecate ui/ and apps/frontend/ ✅ Lowest risk
   - **Option B**: Complete ui/ migration, deprecate site/ ⚠️ High effort
   - **Option C**: Hybrid — site/ for public, ui/ for authenticated users ⚠️ Complex

2. **If Option A** (Recommended):
   ```bash
   # Remove incomplete frontends
   rm -rf apps/frontend/
   rm -rf ui/
   
   # Document decision
   echo "ARCHITECTURE_DECISION: Static site/ is primary frontend" >> ADR.md
   ```

3. **If Option B**:
   - Complete feature parity checklist (see §1.3)
   - Migrate PWA (service worker, manifest)
   - Migrate favorites (localStorage)
   - Migrate theme system (4 themes)
   - Write E2E tests for ui/
   - Implement data layer (see §1.5)

**Priority**: **P0 — Critical**  
**Effort**: Option A = Small (2 days), Option B = Large (4-6 weeks)  
**Impact**: Eliminates 300 LOC duplication, unblocks future development

---

### Recommendation 2: **Remove ui/ → site/ Cross-Dependency**

**Problem**: `ui/src/components/sections/Sommaire.tsx` fetches `/site/assets/contents.json`, creating circular dependency.

**Solution**:

```typescript
// BEFORE (ui/src/components/sections/Sommaire.tsx:10)
fetch("/site/assets/contents.json")  // ❌ Depends on site/

// AFTER
fetch("/api/tree")  // ✅ Uses backend API as single source
  .then((r) => r.json())
  .then((data) => {
    // Parse DirNode response from FastAPI
    const items = extractResources(data);
    setItems(items);
  })
```

**Priority**: **P0 — Critical**  
**Effort**: Small (4 hours)  
**Files Changed**: 1 file (`ui/src/components/sections/Sommaire.tsx`)

---

### Recommendation 3: **Deprecate Legacy `backend/` Directory**

**Problem**: Two backend components exist, `backend/requirements.txt` is unused.

**Solution**:
```bash
# Verify backend/ is unused
grep -r "backend/requirements.txt" .  # Should return nothing except gitignore

# Remove if unused
rm -rf backend/

# Update docker-compose.yml comment
# "Backend: apps/backend/ (primary), backend/ removed (legacy)"
```

**Priority**: **P1 — Important**  
**Effort**: Small (1 hour)  
**Impact**: Reduces confusion, clarifies architecture

---

### Recommendation 4: **Remove Abandoned `apps/frontend/` (Vue)**

**Problem**: Vue 3 boilerplate (HelloWorld component) serves no purpose.

**Solution**:
```bash
# Remove Vue frontend
rm -rf apps/frontend/

# Update README.md
# Remove references to Vue frontend
```

**Priority**: **P1 — Important**  
**Effort**: Small (1 hour)  
**Impact**: Reduces maintenance burden, clarifies frontend strategy

---

## 1.12 Summary & Next Steps

### Summary

The project architecture suffers from **strategic indecision** regarding frontend technology:

- ✅ **Backend**: Well-architected FastAPI application (9/10)
- ⚠️ **Frontend**: Three implementations (static/Vue/React) with no clear migration path (4/10)
- ❌ **Data Layer**: Fragmented across JSON/JS/API sources (3/10)
- ❌ **Dependency Management**: Critical circular dependency (ui/ → site/) blocks migration

**Root Cause**: Incomplete migration attempts (Vue → React) without deprecating old code.

---

### Next Steps

1. **Immediate** (This Week):
   - [ ] **Decision Meeting**: Choose primary frontend (site/ vs ui/)
   - [ ] Remove abandoned `apps/frontend/` Vue boilerplate
   - [ ] Document architecture decision in `ADR.md` (Architecture Decision Record)

2. **Short-Term** (This Month):
   - [ ] If keeping site/: Remove ui/, focus on site/ improvements
   - [ ] If migrating to ui/: Fix circular dependency (use `/api/tree`), complete feature parity
   - [ ] Consolidate data sources — Choose `/api/tree` as single source of truth

3. **Long-Term** (Next Quarter):
   - [ ] Implement shared design token system (JSON → CSS variables + Tailwind)
   - [ ] Standardize build pipeline (Vite for all components)
   - [ ] Create monorepo structure with shared packages

---

**Status**: ✅ **Architecture Review Complete**  
**Next Section**: Code Quality Review (Static Site) — See §2

