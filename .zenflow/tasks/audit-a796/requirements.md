# Product Requirements Document (PRD) — Audit Complet d'Interface Maths 2025-2026

**Date**: 21 février 2026  
**Projet**: Interface Maths 2025-2026  
**Repository**: https://github.com/cyranoaladin/Interface_Maths_2025_2026  
**Type de projet**: Site pédagogique statique (HTML/CSS/JS + PWA) avec backend Python optionnel et frontend React en développement

---

## 1. Contexte et Objectifs de l'Audit

### 1.1 Description du Projet

**Interface Maths 2025-2026** est un site pédagogique **non commercial** destiné aux élèves, parents et enseignants. Il propose:

- Ressources en spécialité mathématiques (Première, Terminale, Maths expertes)
- Progressions annuelles
- Interface premium moderne 100% en français
- PWA (Progressive Web App) avec service worker
- Design inspiré de Linear, Vercel, Stripe, Notion

**Public cible**:
- Élèves de lycée (Première, Terminale)
- Parents
- Enseignants

**Licence**: CC BY-NC-SA 4.0 (pas d'usage commercial)

### 1.2 Architecture Technique

Le projet possède **trois composantes**:

1. **Site statique principal** (`site/`)
   - HTML/CSS/JS vanilla
   - PWA avec manifest.webmanifest et sw.js
   - Design system basé sur CSS variables
   - Icônes Lucide (CDN)
   - Pas de framework frontend

2. **Backend Python** (`backend/`, `apps/backend/`)
   - API optionnelle (`/api/tree`)
   - Probablement Flask ou FastAPI (à vérifier)
   - Tests pytest

3. **Frontend React moderne** (`apps/frontend/`, `ui/`)
   - TypeScript + React
   - Vite
   - Tailwind CSS
   - Vitest pour tests
   - En développement (migration du site statique?)

### 1.3 Objectifs de l'Audit

Réaliser un **audit complet, approfondi et exhaustif** de l'ensemble du projet:

✅ **Analyser les 3 composantes** (site statique, backend Python, frontend React)  
✅ **Évaluer la qualité du code** (HTML/CSS/JS vanilla, Python, TypeScript/React)  
✅ **Vérifier la sécurité** (PWA, backend API, gestion des données)  
✅ **Tester les performances** (chargement, bundle size, lighthouse scores)  
✅ **Auditer l'accessibilité** (WCAG 2.1 AA, tests axe-core)  
✅ **Examiner les tests** (Vitest unitaires, Playwright E2E)  
✅ **Analyser le DevOps** (Docker, CI/CD GitHub Actions, déploiement)  
✅ **Évaluer la documentation** (README, guides techniques)  
✅ **Vérifier le design system** (cohérence UI/UX, thèmes, tokens CSS)

---

## 2. Périmètre de l'Audit

### 2.1 Dimensions à Auditer

| Dimension | Description | Périmètre |
|-----------|-------------|-----------|
| **Architecture** | Structure du projet, séparation des concerns | ✅ 3 composantes (site/backend/frontend) |
| **Qualité du code** | Lisibilité, maintenabilité, DRY, complexité | ✅ HTML/CSS/JS, Python, TypeScript/React |
| **Sécurité** | Vulnérabilités, XSS, secrets, CSP, HTTPS | ✅ PWA, backend API, service worker |
| **Performance** | Lighthouse, bundle size, temps de chargement | ✅ Site statique + frontend React |
| **Accessibilité** | WCAG 2.1 AA, tests axe-core, navigation clavier | ✅ Pages HTML + composants React |
| **Tests** | Couverture, qualité, E2E | ✅ Vitest (unitaires) + Playwright (E2E) |
| **Documentation** | README, guides, commentaires | ✅ Docs techniques et utilisateur |
| **DevOps** | CI/CD, Docker, déploiement, monitoring | ✅ GitHub Actions, Docker Compose, Nginx |
| **Design System** | Cohérence UI, tokens CSS, thèmes | ✅ CSS variables, 4 thèmes (dark/light/energie/pure) |
| **SEO & PWA** | Manifest, service worker, sitemap, robots.txt | ✅ PWA complète |

### 2.2 Fichiers et Dossiers Clés à Analyser

#### Site Statique (`site/`)
- `site/index.html` — Page d'accueil
- `site/assets/css/site.css` — Design system et tokens CSS
- `site/assets/js/` — Logique métier (contents.js, levels.js, progression.js, theme-toggle.js, neon-toggle.js)
- `site/assets/contents.json` et `site/assets/contents.static.js` — Index des ressources
- `site/manifest.webmanifest` — Configuration PWA
- `site/sw.js` — Service worker
- `site/EDS_premiere/`, `site/EDS_terminale/`, `site/Maths_expertes/` — Pages de contenu

#### Backend Python
- `backend/` — À explorer (structure inconnue)
- `apps/backend/` — À explorer
- `tests/test_*.py` — Tests pytest

#### Frontend React
- `apps/frontend/src/` — Code source React
- `ui/src/` — Autre version React?
- `vite.config.ts`, `tailwind.config.js` — Configuration build
- Tests unitaires Vitest

#### DevOps & Configuration
- `.github/workflows/` — CI/CD
- `deploy/docker/` — Docker Compose
- `deploy/nginx/` — Configuration Nginx
- `package.json` — Scripts npm (test, lint, build CSS)

#### Documentation
- `README.md` — Documentation principale (très complète)
- `ARCHITECTURE.md` — À vérifier si existe
- Fichiers markdown dans la racine (CHANGELOG, guides, chartes graphiques)

---

## 3. Méthodologie de l'Audit

### 3.1 Approche en 4 Phases

#### **Phase 1: Analyse Automatisée** (Scripts, outils, métriques)

**Site Statique**:
- ✅ Lighthouse audit (performance, accessibilité, SEO, PWA)
- ✅ ESLint sur `site/assets/js/` (déjà configuré: `npm run lint`)
- ✅ PostCSS build CSS (`npm run css:build`)
- ✅ Recherche de patterns (TODO, FIXME, console.log, secrets hardcodés)
- ✅ Validation HTML (W3C validator ou similaire)
- ✅ Analyse PWA (manifest, service worker)

**Backend Python**:
- ✅ Ruff ou Flake8 (linting Python)
- ✅ Bandit (sécurité Python)
- ✅ pytest avec coverage (`pytest --cov`)
- ✅ Recherche de secrets hardcodés

**Frontend React**:
- ✅ ESLint + TypeScript check
- ✅ Vite build analysis (bundle size)
- ✅ Vitest coverage
- ✅ Recherche de `any`, `@ts-ignore`

**Tests**:
- ✅ `npm run test:unit` (Vitest)
- ✅ `npm run test:e2e` (Playwright)
- ✅ Couverture de code

#### **Phase 2: Revue Manuelle** (Architecture, code, sécurité)

**Architecture**:
- ✅ Comprendre la relation entre les 3 composantes (site/backend/frontend)
- ✅ Identifier les duplications ou incohérences
- ✅ Évaluer la stratégie de migration (si le frontend React remplace le site statique)

**Code Quality**:
- ✅ Revue de 20-30 fichiers représentatifs (HTML, JS, Python, React)
- ✅ Complexité, duplication, nommage
- ✅ Respect des conventions

**Sécurité**:
- ✅ Service worker sécurité (cache poisoning, scope)
- ✅ API backend (CORS, validation, injection)
- ✅ CSP headers (si présents)
- ✅ Secrets et tokens

**Performance**:
- ✅ Analyse du bundle JS (site statique et React)
- ✅ Images optimisées
- ✅ Lazy loading
- ✅ Service worker cache strategy

#### **Phase 3: Documentation & DevOps**

**Documentation**:
- ✅ README complétude (setup, tests, déploiement)
- ✅ Guides utilisateurs et développeurs
- ✅ Commentaires dans le code

**DevOps**:
- ✅ GitHub Actions workflows (backend-ci, deploy, docker-image)
- ✅ Docker Compose (`deploy/docker/docker-compose.yml`)
- ✅ Nginx configuration
- ✅ Stratégie de déploiement

**Accessibilité**:
- ✅ Tests Playwright avec axe-core
- ✅ Navigation clavier
- ✅ Attributs ARIA
- ✅ Contraste de couleurs
- ✅ Langue française (`lang="fr"`)

#### **Phase 4: Synthèse & Recommandations**

- ✅ Consolidation de tous les findings
- ✅ Priorisation (P0, P1, P2, P3)
- ✅ Calcul du score de santé (0-100)
- ✅ Recommandations actionnables
- ✅ Rapport exécutif

### 3.2 Niveaux de Priorité

| Priorité | Critères | Exemples |
|----------|----------|----------|
| **P0** | Blocage critique, sécurité majeure, perte de données | Secret hardcodé, faille XSS, build cassé |
| **P1** | Impact utilisateur important, bugs majeurs | Accessibilité manquante, performance dégradée |
| **P2** | Dette technique moyenne, qualité | Code dupliqué, tests manquants, docs incomplètes |
| **P3** | Améliorations, optimisations mineures | Refactoring, conventions, commentaires |

---

## 4. Livrables Attendus

### 4.1 Rapport Complet d'Audit

**Format**: Markdown (`.zenflow/tasks/audit-a796/COMPREHENSIVE_AUDIT_REPORT.md`)

**Structure**:
1. **Executive Summary**
   - Vue d'ensemble du projet
   - Score de santé global (0-100)
   - Top 5 findings critiques
   - Top 5 recommandations
2. **Métriques Clés**
   - Dashboard quantitatif
   - Comparaisons (avant/après si applicable)
3. **Findings par Dimension** (11 sections)
   - Architecture
   - Qualité du code
   - Sécurité
   - Performance
   - Accessibilité
   - Tests
   - Documentation
   - DevOps
   - Design System
   - SEO & PWA
   - Backend Python (si présent)
4. **Recommandations Priorisées**
   - P0/P1 (à traiter en priorité)
   - P2/P3 (à planifier)
5. **Conclusion et Next Steps**

### 4.2 Fichiers d'Audit Détaillés

- `phase1_automated_findings.md` — Résultats des outils automatisés
- `phase2_manual_findings.md` — Revue manuelle approfondie
- `phase3_docs_devops_findings.md` — Documentation et DevOps
- `audit_metrics.md` — Dashboard de métriques

### 4.3 Plan d'Action

- Liste priorisée des corrections à apporter
- Estimation d'effort (S/M/L/XL)
- Dépendances entre tâches

---

## 5. Critères de Succès de l'Audit

✅ **Exhaustivité**: Tous les fichiers clés analysés (site/backend/frontend)  
✅ **Profondeur**: Revue manuelle approfondie (pas seulement automatisée)  
✅ **Actionnabilité**: Recommandations concrètes avec exemples de code  
✅ **Priorisation**: Findings classés par urgence et impact  
✅ **Métriques**: Dashboard quantitatif complet  
✅ **Clarté**: Rapport compréhensible par devs et non-devs  

---

## 6. Questions Ouvertes et Clarifications

### 6.1 Architecture

❓ **Quelle est la relation entre le site statique et le frontend React?**
- Migration en cours?
- Deux versions parallèles?
- Quelle version est en production?

❓ **Le backend Python est-il déployé en production?**
- Si oui, quelle API expose-t-il?
- Authentification?

### 6.2 Déploiement

❓ **Où est déployé le site?**
- Hébergement statique (Netlify, Vercel, GitHub Pages)?
- Serveur dédié avec Nginx?

❓ **Quelle version est servie en production?**
- Site statique (`site/`)?
- Frontend React (`apps/frontend/` ou `ui/`)?

### 6.3 Tests

❓ **Les tests E2E Playwright couvrent-ils le site statique ou le frontend React?**

❓ **Quelle est la couverture de tests actuelle?**

---

## 7. Hypothèses et Décisions

### 7.1 Hypothèses

1. **Le site statique (`site/`) est la version principale en production** (selon README)
2. **Le frontend React est en développement** (migration progressive?)
3. **Le backend Python est optionnel** (fallback: `contents.json` statique)
4. **Les tests E2E ciblent le site statique** (selon README section 8)
5. **Le projet n'a pas de backend d'authentification** (site public)

### 7.2 Décisions Autonomes

✅ **Analyser les 3 composantes** même si certaines sont en développement  
✅ **Prioriser le site statique** car c'est la version documentée comme principale  
✅ **Tester la PWA** (manifest + service worker)  
✅ **Vérifier la cohérence** entre les versions (duplication de code?)  
✅ **Auditer l'accessibilité** (exigence forte selon README)  
✅ **Évaluer le design system** (4 thèmes CSS, tokens)  

---

## 8. Timeline et Effort Estimé

### 8.1 Effort par Phase

| Phase | Description | Temps estimé |
|-------|-------------|--------------|
| Phase 1 | Analyse automatisée (lint, tests, lighthouse) | 2-3h |
| Phase 2 | Revue manuelle (architecture, code, sécurité) | 4-6h |
| Phase 3 | Documentation & DevOps | 2-3h |
| Phase 4 | Synthèse & rapport | 2-3h |
| **Total** | | **10-15h** |

### 8.2 Livrables Intermédiaires

- ✅ Après Phase 1: `phase1_automated_findings.md`
- ✅ Après Phase 2: `phase2_manual_findings.md`
- ✅ Après Phase 3: `phase3_docs_devops_findings.md`
- ✅ Final: `COMPREHENSIVE_AUDIT_REPORT.md` + `audit_metrics.md`

---

## 9. Spécificités du Projet

### 9.1 Points Forts Attendus (selon README)

✅ **Documentation exhaustive** (README très complet)  
✅ **Design system structuré** (tokens CSS, 4 thèmes)  
✅ **Tests E2E avec accessibilité** (Playwright + axe-core)  
✅ **PWA complète** (manifest + service worker)  
✅ **100% en français** (tests E2E vérifient l'absence d'anglais)  
✅ **CI/CD mature** (3 workflows GitHub Actions)  

### 9.2 Risques Potentiels

⚠️ **Duplication de code** entre site statique et frontend React  
⚠️ **Maintenance de 3 composantes** (complexité)  
⚠️ **Service worker** (sécurité, cache invalidation)  
⚠️ **Performance** (bundle JS, images non optimisées?)  
⚠️ **Backend Python** (si déployé: sécurité API, tests)  

---

## 10. Conclusion

Cet audit vise à fournir une **évaluation complète et exhaustive** du projet **Interface Maths 2025-2026**, en analysant ses **3 composantes** (site statique, backend Python, frontend React) selon **11 dimensions**.

Les findings seront **priorisés**, **actionnables** et accompagnés d'un **dashboard de métriques** pour guider les prochaines étapes d'amélioration.

---

**Prochaine étape**: Créer la spécification technique (`spec.md`) détaillant l'approche d'audit pour chaque composante.
