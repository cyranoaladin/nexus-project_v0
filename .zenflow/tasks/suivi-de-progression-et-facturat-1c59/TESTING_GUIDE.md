# Performance & Security Testing Guide

## Overview
This document outlines the performance, security, and accessibility testing procedures for the Parent Dashboard feature.

---

## 1. Performance Testing

### 1.1 Large Dataset Testing

**Objective**: Verify dashboard handles 100 badges and 500+ transactions without performance degradation.

**Steps**:
1. Run performance seeding script:
   ```bash
   npx tsx scripts/test-performance.ts
   ```

2. Start dev server:
   ```bash
   npm run dev
   ```

3. Login as `parent.test@example.com`

4. Navigate to `/dashboard/parent`

5. Open Browser DevTools (F12) → Network tab

**Expected Results**:
- ✅ API response time < 2 seconds
- ✅ Response payload size < 1MB
- ✅ Dashboard renders all badges smoothly
- ✅ No browser console errors
- ✅ Pagination works correctly (20 items per page)
- ✅ Smooth scrolling and filtering

**Actual Measurements**:
- API Response Time: _____ ms
- Response Size: _____ KB
- Time to Interactive: _____ ms
- Total DOM nodes: _____

---

### 1.2 Memory Leak Testing

**Steps**:
1. Open Chrome DevTools → Performance tab
2. Click "Record" button
3. Interact with dashboard:
   - Switch between children
   - Filter badges by category (5 times)
   - Filter transactions (10 different filters)
   - Load more transactions (3 times)
4. Stop recording

**Expected Results**:
- ✅ Memory usage stable (no continuous growth)
- ✅ Heap size returns to baseline after interactions
- ✅ No detached DOM nodes

**Actual Measurements**:
- Initial Heap Size: _____ MB
- Peak Heap Size: _____ MB
- Final Heap Size: _____ MB

---

### 1.3 Bundle Size Testing

**Steps**:
```bash
npm run build
```

**Expected Results**:
- ✅ Build completes without errors
- ✅ No bundle size warnings
- ✅ Parent dashboard route < 500KB (gzipped)

**Actual Measurements**:
- Total bundle size: _____ KB
- Parent dashboard route: _____ KB

---

## 2. Security Testing

### 2.1 Authentication & Authorization

**Test Cases**:

| Test | Steps | Expected Result | Status |
|------|-------|----------------|--------|
| Unauthenticated access | Access `/dashboard/parent` without login | Redirect to `/auth/signin` | ⬜ |
| Non-parent role | Login as STUDENT, access parent dashboard | 403 Forbidden | ⬜ |
| Session validation | Login, delete session cookie, refresh | Redirect to login | ⬜ |
| API authentication | Call `/api/parent/dashboard` without session | 401 Unauthorized | ⬜ |
| API authorization | Call API with STUDENT session | 403 Forbidden | ⬜ |

---

### 2.2 Data Isolation Testing

**Objective**: Ensure Parent A cannot see Parent B's data.

**Steps**:
1. Create two parent accounts:
   - Parent A: `parent.test@example.com`
   - Parent B: `parent2.test@example.com`

2. Assign different children to each parent

3. Login as Parent A:
   - Note child IDs displayed
   - Check Network requests for child IDs

4. Login as Parent B:
   - Verify different children displayed
   - Ensure no overlap with Parent A's children

5. Try to manipulate API requests:
   - Copy Parent A's child ID
   - While logged in as Parent B, try to access Parent A's child data

**Expected Results**:
- ✅ Each parent sees only their own children
- ✅ API returns 403 if trying to access other parent's data
- ✅ No child IDs exposed in URL parameters
- ✅ Session validates parent-child relationship server-side

**Checklist**:
- ⬜ Parent A and Parent B have separate children
- ⬜ API validates parentId matches session user
- ⬜ No SQL injection vulnerabilities in filters
- ⬜ No cross-parent data leakage

---

### 2.3 Sensitive Data Exposure

**Steps**:
1. Open Browser DevTools → Console
2. Navigate parent dashboard
3. Perform various actions (filter, switch children, etc.)
4. Check console logs for:
   - User IDs
   - Session tokens
   - Email addresses
   - Child personal data

5. Open Network tab
6. Inspect API responses for:
   - Passwords or hashes
   - Full credit card numbers
   - Other sensitive data

**Expected Results**:
- ✅ No sensitive data in console logs
- ✅ No credentials in network responses
- ✅ No personal data exposed unnecessarily
- ✅ Proper sanitization of user inputs

**Checklist**:
- ⬜ No console.log with sensitive data in production
- ⬜ API responses contain only necessary data
- ⬜ No inline secrets or API keys
- ⬜ HTTPS enforced in production

---

### 2.4 Input Validation & XSS Testing

**Test Cases**:

| Input Field | Test Value | Expected Behavior | Status |
|-------------|-----------|-------------------|--------|
| Date filter (from) | `<script>alert('XSS')</script>` | Input sanitized, no script execution | ⬜ |
| Date filter (to) | `'; DROP TABLE users; --` | Input validated, rejected | ⬜ |
| CSV export filename | `../../../etc/passwd` | Path traversal blocked | ⬜ |

---

## 3. Accessibility Testing

### 3.1 Keyboard Navigation

**Test Procedure**:
1. Open `/dashboard/parent`
2. Press Tab key repeatedly
3. Navigate through all interactive elements

**Expected Tab Order**:
1. Logout button
2. Child selector dropdown
3. Add child button
4. Badge category tabs (All, Assiduité, Progression, Curiosité)
5. Chart type selector
6. Time range selector
7. Transaction filters (Type, Child, Status, Date from, Date to)
8. Export CSV button
9. Clear filters button
10. Table column headers (sortable)
11. Load more button

**Checklist**:
- ⬜ All interactive elements accessible via Tab
- ⬜ Focus indicators clearly visible
- ⬜ Logical tab order maintained
- ⬜ Shift+Tab reverses navigation
- ⬜ Enter/Space activates buttons and toggles
- ⬜ Escape closes dialogs/dropdowns
- ⬜ Arrow keys navigate within dropdowns
- ⬜ No keyboard traps

---

### 3.2 Screen Reader Testing

**Tools**: 
- macOS: VoiceOver (Cmd+F5)
- Windows: NVDA (free)
- Linux: Orca

**Test Procedure**:
1. Enable screen reader
2. Navigate dashboard with keyboard
3. Verify announcements are clear and informative

**Expected Announcements**:

| Element | Expected Announcement |
|---------|----------------------|
| Badge category tab | "Assiduité, 5 badges" |
| Chart type selector | "Type de graphique, Tendance selected" |
| Time range selector | "Période d'affichage, 3 mois selected" |
| Transaction table | "Historique des transactions financières, table" |
| Sort column | "Date, sortable column header, sorted descending" |
| Export button | "Exporter l'historique en format CSV, button" |
| Loading state | "Chargement de votre espace" |
| Error state | "Erreur lors du chargement" |

**Checklist**:
- ⬜ All images have alt text
- ⬜ Icons have aria-label or aria-hidden
- ⬜ Form inputs have labels
- ⬜ Tables have proper role and headers
- ⬜ Dynamic content changes announced
- ⬜ Loading states announced
- ⬜ Error messages announced

---

### 3.3 Color Contrast Testing

**Tool**: Browser extension (aXe DevTools, WAVE, or Lighthouse)

**Steps**:
1. Install aXe DevTools extension
2. Open Parent Dashboard
3. Run accessibility scan

**WCAG 2.1 AA Requirements**:
- Normal text (< 18pt): 4.5:1 contrast ratio
- Large text (≥ 18pt or 14pt bold): 3:1 contrast ratio
- UI components: 3:1 contrast ratio

**Elements to Check**:

| Element | Foreground | Background | Ratio | Pass/Fail |
|---------|-----------|------------|-------|-----------|
| Primary text | `#111827` | `#FFFFFF` | 16.05:1 | ⬜ |
| Secondary text | `#6B7280` | `#FFFFFF` | 4.69:1 | ⬜ |
| Status badge (green) | `#065F46` | `#D1FAE5` | 5.23:1 | ⬜ |
| Status badge (yellow) | `#92400E` | `#FEF3C7` | 6.14:1 | ⬜ |
| Status badge (red) | `#991B1B` | `#FEE2E2` | 5.89:1 | ⬜ |
| Link/button text | `#2563EB` | `#FFFFFF` | 7.52:1 | ⬜ |
| Chart line | `#2563EB` | `#FFFFFF` | 7.52:1 | ⬜ |

**Checklist**:
- ⬜ All text meets 4.5:1 ratio
- ⬜ Large text meets 3:1 ratio
- ⬜ Focus indicators have 3:1 ratio
- ⬜ Status badges readable
- ⬜ Charts use distinct colors (not only color to convey info)

---

### 3.4 ARIA Labels Audit

**Checklist**:
- ✅ Child selector: `aria-label="Sélectionner un enfant"`
- ✅ Badge tabs: `aria-label="Filtrer les badges par catégorie"`
- ✅ Chart type selector: `aria-label="Type de graphique"`
- ✅ Time range selector: `aria-label="Période d'affichage"`
- ✅ Transaction filters: `aria-label` on each filter
- ✅ Table: `role="table"` and `aria-label="Historique des transactions financières"`
- ✅ Column headers: `role="columnheader"` with `aria-sort`
- ✅ Charts: `role="img"` with descriptive `aria-label`
- ✅ Loading indicators: `aria-label="Chargement"`
- ✅ Error icons: `aria-label="Erreur"`
- ✅ Buttons: Clear labels or `aria-label`

---

## 4. Cross-Browser Testing

**Browsers to Test**:
- ✅ Chrome/Edge (Chromium) - Latest
- ⬜ Firefox - Latest
- ⬜ Safari - Latest (macOS/iOS)

**Test Matrix**:

| Feature | Chrome | Firefox | Safari |
|---------|--------|---------|--------|
| Dashboard loads | ⬜ | ⬜ | ⬜ |
| Badges display correctly | ⬜ | ⬜ | ⬜ |
| Charts render | ⬜ | ⬜ | ⬜ |
| Filters work | ⬜ | ⬜ | ⬜ |
| CSV export downloads | ⬜ | ⬜ | ⬜ |
| Responsive design | ⬜ | ⬜ | ⬜ |
| Animations smooth | ⬜ | ⬜ | ⬜ |

---

## 5. Responsive Design Testing

**Viewports to Test**:
- Mobile: 375x667 (iPhone SE)
- Tablet: 768x1024 (iPad)
- Desktop: 1920x1080

**Test Cases**:

| Feature | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Layout adapts | ⬜ | ⬜ | ⬜ |
| Text readable | ⬜ | ⬜ | ⬜ |
| Buttons touchable (44x44px min) | ⬜ | ⬜ | ⬜ |
| Tables scrollable/responsive | ⬜ | ⬜ | ⬜ |
| Charts resize correctly | ⬜ | ⬜ | ⬜ |
| Filters stack properly | ⬜ | ⬜ | ⬜ |
| No horizontal scroll | ⬜ | ⬜ | ⬜ |

---

## 6. Test Results Summary

### Performance
- [ ] API response time < 2s
- [ ] Response size < 1MB
- [ ] No memory leaks
- [ ] Build succeeds

### Security
- [ ] Authentication enforced
- [ ] Authorization validated
- [ ] Data isolation verified
- [ ] No sensitive data exposed
- [ ] Input validation working

### Accessibility
- [ ] Keyboard navigation complete
- [ ] Screen reader compatible
- [ ] Color contrast WCAG AA
- [ ] ARIA labels present
- [ ] Focus indicators visible

### Compatibility
- [ ] Chrome/Edge working
- [ ] Firefox working
- [ ] Safari working
- [ ] Mobile responsive
- [ ] Tablet responsive
- [ ] Desktop responsive

---

## 7. Known Issues & Limitations

_Document any issues found during testing here:_

1. 

---

## 8. Recommendations

_Add recommendations for future improvements:_

1. Consider implementing virtual scrolling for 500+ transactions
2. Add performance monitoring (e.g., Sentry, DataDog)
3. Implement rate limiting on API endpoints
4. Add CSP (Content Security Policy) headers
5. Consider adding unit tests for accessibility

---

**Tested by**: _________________  
**Date**: _________________  
**Version**: _________________
