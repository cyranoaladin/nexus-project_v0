# Post-Go-Live Technical Debt Backlog

**Date :** 2026-06-26
**Baseline :** `6388ff9ce` (go-live SHA)

## Dettes tracées

### 1. CSP : durcissement nonce (script-src)
- **Fichier :** `lib/security-headers.ts`
- **Constat :** `script-src` utilise `'unsafe-inline'` + `'unsafe-eval'` (requis par Next.js inline scripts et WebAssembly)
- **Action :** Implémenter un CSP nonce-based (custom Document + middleware per-request nonce)
- **Sévérité :** Moyenne — fonctionnel mais sous-optimal en sécurité

### 2. `X-Content-Type-Options: nosniff` absent sur assets statiques
- **Fichier :** Middleware matcher exclut `/_next/static` et les images
- **Constat :** Les assets statiques ne reçoivent pas les en-têtes de sécurité
- **Action :** Ajouter `nosniff` via nginx `location /_next/static` ou étendre le middleware matcher
- **Sévérité :** Faible — les assets statiques n'exécutent pas de JS

### 3. OG SSOT partiel : 11 openGraph inline subsistent
- **Fichiers :** `app/page.tsx`, `app/offres/layout.tsx`, `app/stages/layout.tsx`, `app/bilan-gratuit/page.tsx`, `app/bilan-gratuit/layout.tsx`, `app/accompagnement-scolaire/layout.tsx`, `app/famille/layout.tsx`, `app/equipe/layout.tsx`, `app/notre-centre/layout.tsx`, `app/recommandation/page.tsx`, `app/ressources/page.tsx`
- **Constat :** Ces fichiers définissent `openGraph` inline avec `OG_DEFAULT_IMAGE` au lieu d'utiliser `buildPageMetadata()`
- **Action :** Migrer vers `buildPageMetadata()` pour SSOT complète
- **Sévérité :** Faible — fonctionnel, juste pas DRY

### 4. `\u2019` cosmétique dans `app/plateforme-aria/layout.tsx`
- **Fichier :** `app/plateforme-aria/layout.tsx:5`
- **Constat :** Description utilise `\u2019` (JS escape) au lieu de `'` (UTF-8 direct) — rendu correct mais incohérent avec la garde unicode (qui ne teste que `\u00xx`)
- **Action :** Remplacer par apostrophe curly UTF-8 directe dans un string double-quoted
- **Sévérité :** Cosmétique

### 5. Garde EXCLUDED_FROM_CHARTE : pas de vérification noindex/redirect
- **Fichier :** `__tests__/marketing/public-lux-charte-guard.test.ts`
- **Constat :** Les fichiers dans `EXCLUDED_FROM_CHARTE` sont listés manuellement mais la garde ne vérifie pas qu'ils ont effectivement `noindex` ou `redirect()` — un fichier pourrait perdre son noindex et rester exclu
- **Action :** Ajouter un test qui valide que chaque entrée EXCLUDED a bien `noindex` dans sa metadata ou `redirect()` dans son code
- **Sévérité :** Faible — risque de régression silencieuse

### 6. `app/bilan-pallier2-maths/dashboard/page.tsx` dans EXCLUDED mais potentiellement mort
- **Fichier :** `__tests__/marketing/public-lux-charte-guard.test.ts`
- **Constat :** Cette entrée est dans EXCLUDED_FROM_CHARTE mais pourrait ne pas exister — non vérifié
- **Action :** Vérifier l'existence et le statut, retirer si mort
- **Sévérité :** Cosmétique

### 7. LUX_PALETTE dans la garde `global-error.tsx` recopiée en dur
- **Fichier :** `__tests__/marketing/public-lux-charte-guard.test.ts`
- **Constat :** Les hex de la palette lux sont recopiés en dur dans le test au lieu d'être dérivés de `globals.css` ou `lib/theme/tokens.ts`
- **Action :** Dériver la palette depuis le fichier source pour rester SSOT
- **Sévérité :** Faible — divergence possible si les tokens changent

### 8. Gardes bare-eyebrow + raw-palette : heuristique fragile
- **Fichier :** `__tests__/marketing/public-lux-charte-guard.test.ts`
- **Constat :** Les gardes `bare lux-eyebrow` et `raw palette tokens` utilisent `line.includes()` sur la même ligne — une `className` multi-ligne (template literal ou formatage Prettier) pourrait échapper à la détection
- **Action :** Parser les className comme des blocs multi-lignes (regex multi-ligne ou extraction AST simplifiée) au lieu du scan ligne par ligne
- **Sévérité :** Faible — les formateurs actuels gardent les className sur une seule ligne, mais fragile si le style de code change

### 9. Vhost nginx non versionné
- **Fichier :** `/etc/nginx/sites-enabled/nexusreussite.academy` (serveur uniquement)
- **Constat :** Le commentaire a été corrigé côté serveur ("Docker container" → "PM2 standalone") mais ce fichier n'est pas versionné dans le repo — une reconstruction du serveur depuis zéro perdrait cette correction
- **Action :** Versionner le vhost sous `infra/nginx/nexusreussite.academy` (ou équivalent) avec un README décrivant la procédure de déploiement
- **Sévérité :** Moyenne — risque de divergence silencieuse en cas de reconstruction serveur

### 10. Docker Compose vestigial dans le repo
- **Fichiers :** `Dockerfile.prod`, `docker-compose.prod.yml`, `docker-compose.yml`
- **Constat :** Le README documente désormais PM2 comme runtime prod. Les fichiers Docker pour Next.js sont vestigiaux mais toujours présents dans le repo
- **Action :** Évaluer la suppression ou le déplacement sous `docker/archive/` si plus aucun workflow ne les utilise. Garder `docker-compose.e2e.yml` et `docker-compose.test.yml` s'ils servent les tests
- **Sévérité :** Hygiène — pas de risque fonctionnel
