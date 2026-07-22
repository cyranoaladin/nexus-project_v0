# Audit complet & plan d'action — nexusreussite.academy

Repo audité : `cyranoaladin/nexus-project_v0` (branche `main`).
Périmètre : business model, tarification, logique métier, architecture, sécurité/RBAC, marketing/growth/conversion, SEO, design/UI-UX, performance.
Posture : audit adossé à la source — chaque constat est vérifiable en une étape (fichier:ligne, clé JSON, route). Les affirmations non prouvées sont marquées « à confirmer ».

---

## 0. Méthode & périmètre

L'audit distingue trois statuts pour chaque constat :

- **Vérifié** : prouvé en source pendant cet audit (clé JSON, fichier, route).
- **Documenté** : déjà établi et prouvé par le corpus d'architecture interne (DOC-1 à DOC-5) et repris ici en synthèse, sans le re-prouver.
- **À confirmer** : hypothèse plausible nécessitant une mesure ou une donnée de production (ex. compte de lignes, poids de bundle).

Le corpus DOC-1 à DOC-5 (inventaire census-prouvé, cartographie, dashboards, couche de gestion, plan de migration) couvre déjà l'essentiel de l'architecture et de la logique métier. Le présent rapport ne le duplique pas : il le synthétise, et concentre sa valeur ajoutée sur les dimensions non couvertes (business model sous l'angle growth, marketing, conversion, SEO, design/UI-UX) et sur une priorisation unique « mise au point du site ».

---

## 1. Synthèse exécutive

Le site repose sur une base technique réelle et déjà durcie (go-live polish clos, charte lux, SEO centralisé, sécurité des routes classée sans trou). Le travail de finalisation restant n'est pas une reconstruction : c'est la résolution d'un petit nombre d'incohérences métier à fort impact et le comblement de lacunes de conversion.

Niveau de finalisation estimé : **structurellement avancé, fonctionnellement à consolider**. Les sept constats majeurs :

1. **Incohérence de crédits (R2) — impact argent direct.** Trois plans d'abonnement octroient le double des crédits annoncés. Source : double registre de crédits divergent. C'est la dette la plus prioritaire car elle touche la facturation réelle.
2. **Le SSOT tarifaire se contredit lui-même.** `pricing.canonical.json` se déclare « source de vérité unique » mais porte deux représentations parallèles (legacy + `operational_*`) des mêmes objets.
3. **Aucune preuve sociale affichée.** `social-proof.json` est vide — choix honnête (pas de faux avis), mais lacune de conversion à combler par de vrais témoignages collectés.
4. **Paiement par carte non actif.** Seul le virement bancaire est opérationnel → friction de conversion sur l'acte d'achat.
5. **L'admin et l'assistante ne pilotent pas le modèle économique** depuis leur interface (prix, crédits, règles sont statiques). La couche de gestion correctrice est conçue (DOC-4) et planifiée (DOC-5), pas encore livrée.
6. **Dette de cohérence des données** : pas de clé étrangère Payment↔Invoice, montants en Float vs Int millimes, modèles morts ou divergents (StudentReport, StageBilan vs Bilan, EamProgress/NsiPracticeProgress).
7. **Risque perf récent** : la déduplication group-rules (Lot 1) a possiblement réinjecté un JSON de 40 Ko dans le bundle client des deux pages marketing les plus optimisées — à mesurer et corriger.

---

## 2. Business model & tarification

### 2.1 Structure servie (vérifié)

Trois plans d'abonnement opérationnels mensuels (`operational_subscription_plans`) :

| Plan | Prix (TND/mois) | Crédits annoncés |
|------|:---:|:---:|
| ACCES_PLATEFORME | 150 | 0 |
| HYBRIDE | 450 | 4 |
| IMMERSION | 750 | 8 |

Règles métier (`rules`) : `group_max` = 5, acompte 30 % (annuel et stage), 9 échéances par défaut, arrondi 10 TND, acompte non remboursable sauf groupe non ouvert, déductible de l'annuel, reportable. Catalogue riche au-delà des abonnements : offres annuelles, formats de stage + calendrier + éditions, offres ponctuelles, coaching, packs, programmes spéciaux, add-on ARIA, carte Nexus, urgence, repères tarifaires.

### 2.2 Le SSOT se contredit (vérifié — dette)

`pricing.canonical.json` porte un en-tête « SOURCE DE VÉRITÉ UNIQUE… aucun montant TND ne doit être codé en dur », mais contient **deux représentations parallèles** des mêmes objets :

| Représentation legacy | Représentation opérationnelle |
|---|---|
| `subscription_tiers` (liste, 3) | `operational_subscription_plans` (dict, 3) |
| `aria_addon` (dict, 2) | `operational_aria_addons` (dict, 2) |
| `packs` (liste, 6) | `operational_special_packs` (dict, 3) |

Un fichier qui se déclare source unique mais maintient deux structures parallèles est une source unique en théorie seulement. Tant que les accesseurs ne lisent pas sans ambiguïté un seul des deux jeux, il existe un risque que l'affichage marketing (`getAllOffers`, `getSubscriptionTiers`) et la logique d'octroi divergent — ce qui est précisément le mécanisme de R2.

### 2.3 R2 — triple collision de crédits (documenté, reconfirmé en source)

Les crédits octroyés à l'achat proviennent d'un registre distinct (`PRODUCT_REGISTRY`) qui diverge systématiquement du canonical :

| Plan | Crédits canonical | Crédits réellement octroyés | Écart |
|------|:---:|:---:|:---:|
| ACCES_PLATEFORME → ABONNEMENT_ESSENTIEL | 0 | 4 | +4 |
| HYBRIDE → ABONNEMENT_HYBRIDE | 4 | 8 | ×2 |
| IMMERSION → ABONNEMENT_IMMERSION | 8 | 16 | ×2 |

Les deux échelles sont mensuelles : le facteur ×2 est un vrai sur-octroi, pas un artefact d'unité. Un client achetant le plan à 0 crédit annoncé reçoit 4 crédits. **Impact business direct** : chaque vente d'abonnement distribue plus de crédits que vendu, ce qui érode la marge et fausse le modèle. La décision métier — quelle échelle fait foi (0/4/8, 4/8/16, ou autre) — appartient au fondateur ; le mécanisme de résolution est conçu (DOC-4, store runtime à source unique).

### 2.4 Autres dettes business-data (documenté)

- **R3 — Float vs Int millimes** : `Payment.amount` en Float, `Invoice.total` en Int millimes, sans pont fiable. Risque de pertes de centimes à la conversion côté client.
- **Signal 4 — pas de FK Payment↔Invoice** : impossible de relier nativement un paiement à sa facture. Aucune vue croisée possible sans jointure applicative fragile.

---

## 3. Logique métier & cohérence

La cartographie complète des incohérences est établie dans DOC-2 (10 risques R1–R10, chacun coordonné en source). Synthèse des points structurants pour la mise au point :

- **HIGH — R2** (crédits) : traité §2.3.
- **MEDIUM — modèles morts ou divergents** : `StudentReport` (aucune lecture/écriture côté code), `StageBilan` redondant avec `Bilan`, `EamProgress`/`NsiPracticeProgress` de forme proche mais non unifiés.
- **MEDIUM — double statut `StageReservation`** (`status` String legacy + `richStatus` enum) : risque d'affichage incohérent.
- **MEDIUM — `coachId` non synchronisé** après fin d'affectation : records orphelins (Bilan, SessionBooking) conservent l'ancien coach.

Ces points sont déjà séquencés en lots de migration non destructifs (DOC-5, lots 2 et 9–11), avec tables conservées en lecture seule et bascule réversible.

---

## 4. Architecture & dette technique

Volumétrie prouvée (DOC-1, census filesystem) : **64 modèles Prisma, 173 routes API, 70 pages dashboard**, 5 rôles (ADMIN, ASSISTANTE, COACH, PARENT, ELEVE).

Constats structurants :

- **Couche de gestion absente.** L'admin et l'assistante ne disposent d'aucune interface pour piloter le modèle économique (tarifs, crédits, règles, produits sont statiques — fichier JSON ou code TypeScript). Prouvé par absence contre l'inventaire de routes (DOC-3 §2). La correction — un store runtime versionné `BusinessConfig` avec snapshot mémoire sync, validation structurelle et audit — est entièrement conçue (DOC-4) et planifiée (DOC-5, lots 3–7).
- **`main` historiquement stagnant** et dérives de schéma (constat des audits antérieurs) : à confirmer comme résolu sur l'état courant.
- **Cartographie route→modèle directe uniquement** : les mutations transitives via lib (ex. `activateEntitlements()`) ne sont pas tracées par l'inventaire — limite connue et documentée.

Le plan de migration (DOC-5) ordonne 11 lots par risque croissant, chacun déployable et réversible sous le gate canonique complet. Le lot 1 (déduplication group-rules) est livré ; voir §8.2 pour une réserve perf ouverte.

---

## 5. Sécurité & RBAC

État solide (documenté DOC-1, classification d'auth corrigée) :

- **173 routes classées, 0 route non gardée** : 67 centralisées + 1 RBAC + 80 inline + 25 publiques.
- **Le middleware exclut `/api`** (`matcher` en négatif) : toute l'autorisation API est au niveau handler, sans filet middleware. C'est cohérent et vérifié, mais impose que chaque nouvelle route porte explicitement sa garde — d'où l'étape « guards » du gate canonique.
- **1 CONCERN** : `/api/stages/[stageSlug]/inscrire` — preset rate-limit permissif (60/min), pas de CAPTCHA ; le spam est bloqué par la contrainte unique `[email, academyId]` mais l'endpoint reste exposé à un volume d'écritures. À durcir (preset plus strict ou challenge) avant montée en charge marketing.

Recommandation transverse : la frontière ADMIN/ASSISTANTE doit rester enforced au handler (`requireRole` vs `requireAnyRole`), jamais au masquage UI — principe déjà acté dans DOC-4.

---

## 6. Marketing, growth & conversion

### 6.1 Preuve sociale (vérifié — lacune)

`content/social-proof.json` = `{ "reviews": [], "rating": null }`. Aucun avis ni note affiché. C'est conforme à la règle de communication (pas de chiffres invérifiables) et préférable à de faux témoignages — mais la preuve sociale est un levier de conversion majeur. **Action** : mettre en place une collecte structurée de vrais avis (élèves/parents ayant utilisé la plateforme), puis les afficher avec attribution vérifiable. Formulations qualitatives en attendant (« ceux qui l'ont utilisée », « plusieurs centaines d'élèves accompagnés »), jamais de compteur inventé.

### 6.2 Friction d'achat (vérifié)

Le parcours de paiement (`app/dashboard/parent/paiement/page.tsx`) est centré sur le **virement bancaire** ; le paiement par carte n'est pas actif (« Bientôt disponible », documenté DOC-3). Le virement allonge le cycle d'encaissement et augmente l'abandon. **Action** : prioriser l'activation d'un paiement carte (ou un PSP local) — c'est un gain de conversion direct sur l'acte le plus sensible du funnel.

### 6.3 Tunnel & cohérence de l'offre

L'affichage des crédits côté parent (`/parent/abonnements`) doit refléter la valeur réellement octroyée (résolution R2), sinon le client constate un écart entre annoncé et reçu — érosion de confiance. Aligner l'affichage sur la source unique une fois R2 tranché.

### 6.4 Communication (rappel de charte)

Respect strict des règles établies : pas de compteurs d'utilisateurs invérifiables ; pour les communications type LaboMaths, éviter le mot « formation » au profit d'échanges de pratique / curiosité / culture. Ces règles sont déjà respectées dans l'état actuel (social-proof vide le confirme).

---

## 7. SEO & découvrabilité

Base saine (vérifié) :

- `app/sitemap.ts` → présent (HTTP 200).
- `app/robots.ts` → présent (HTTP 200).
- `lib/seo.ts` → SSOT `buildPageMetadata` (title, description, OG par défaut, siteName « Nexus Réussite », locale, type) — cohérent avec le root layout, issu du go-live (OG SSOT).

Points à confirmer / renforcer :

- **Couverture du sitemap** : vérifier qu'il liste toutes les pages publiques indexables (offres, équipe, pages matières, légales) et exclut le dashboard.
- **Données structurées JSON-LD / schema.org** : absentes à confirmer. Ajouter `EducationalOrganization` + `Course`/`Offer` améliorerait l'éligibilité aux rich results et la visibilité locale (Tunis).
- **Métadonnées par page** : confirmer que chaque page publique appelle `buildPageMetadata` avec title/description spécifiques (pas de fallback générique).

---

## 8. Design & UI/UX

### 8.1 Acquis (documenté)

Charte « lux » migrée et gardée par tests (`public-lux-charte-guard`, `unicode-escape-guard`), pages d'erreur 404/500/global-error stylées, manifest et headers de sécurité, CSS mort purgé. Perf-1 a porté la home de 68→83 et `/offres` de 67→86 (LCP divisé par deux, CLS 0), A11y/SEO/Best-Practices à 100. Résiduel sub-90 tracé à un plancher d'hydratation React+Next sous throttle Lighthouse, documenté.

### 8.2 Réserve perf ouverte (vérifié — à corriger)

Le lot 1 a déplacé 4 composants client (`HomePageClient`, `equipe`, `acadomia-inspired`, `MethodSection`, tous `'use client'`) de la copie légère `GROUP_RULES` vers `getRules()` de `lib/pricing.ts`, qui importe `pricing.canonical.json` (**40 589 octets**) au niveau module et n'est pas marqué `server-only`. Le garde charte qui interdisait précisément cet import a été inversé. Conséquence probable : le JSON de 40 Ko entre dans le bundle client des deux pages marketing les plus optimisées. **Le gate canonique ne mesure pas le poids du bundle**, donc cette régression passe « au vert ». **Action** : mesurer le « First Load JS » de `/` et `/equipe` avant/après ; si régressé, dédupliquer autrement (petit module client-safe partagé, ou passage des valeurs en props depuis un composant serveur) et ajouter une garde de poids de bundle au gate.

### 8.3 UX des dashboards

Cinq dashboards par rôle, le plus riche étant l'élève. Les manques sont des manques de **gestion** (admin/assistante), pas d'affichage élève : absence d'écrans de configuration métier, de supervision (crons, audit, ARIA), de réconciliation crédits, de CRUD stages côté assistante. Ces trous sont prouvés (DOC-3 §2) et adressés par la couche de gestion cible (DOC-4).

---

## 9. Performance

Acquis Perf-1 préservé (§8.1). Deux points de vigilance :

- **Bundle client marketing** (§8.2) — réserve ouverte, à mesurer.
- **Lecture de config sur chemins chauds** : la cible BusinessConfig utilise un snapshot mémoire sync (0 requête DB sur le rendu pricing) — bonne décision déjà actée (DOC-4 v3/v4), valable sous PM2 mono-instance (`instances: 1`, fork, vérifié). Sous cluster/scale horizontal, prévoir l'invalidation cross-instance (documenté comme prérequis).

---

## 10. Plan d'action priorisé — mise au point du site

Priorisation par impact business et risque, en un seul fil.

### P0 — Bloquants de la mise au point (argent, confiance, conversion)

| # | Action | Pourquoi | Dépend de |
|---|--------|----------|-----------|
| P0-1 | **Trancher R2** (échelle de crédits qui fait foi) puis la résoudre à la source via le store runtime | Sur-octroi ×2 systématique = perte de marge sur chaque vente | Décision fondateur + lots 3–5 |
| P0-2 | **Mesurer puis corriger le bundle client** de `/` et `/equipe` (réserve Lot 1) | Régression perf probable sur les pages d'entrée du funnel | — |
| P0-3 | **Activer un moyen de paiement carte** (ou PSP local) | Lever la friction d'achat majeure (virement seul) | — |
| P0-4 | **Aligner l'affichage des crédits** parent sur la valeur réelle | Écart annoncé/reçu = perte de confiance | P0-1 |

### P1 — Consolidation structurelle (cohérence, gestion, données)

| # | Action | Pourquoi |
|---|--------|----------|
| P1-1 | Livrer la **couche de gestion** (store BusinessConfig + écrans admin/assistante) | Permet à l'admin de piloter prix/crédits/règles sans développeur ; résout R2 à la racine (DOC-4/5 lots 3–7) |
| P1-2 | **Unifier le SSOT tarifaire** : choisir entre legacy et `operational_*`, supprimer le doublon | Un fichier « source unique » ne doit pas porter deux structures parallèles |
| P1-3 | **Ajouter la garde de poids de bundle** au gate canonique | Empêcher qu'une régression perf repasse au vert |
| P1-4 | **Corriger R3** (Float→Int millimes cohérent) et établir le pont **Payment↔Invoice** | Fiabilité financière et vue croisée |
| P1-5 | **Collecter et afficher de vrais avis** (preuve sociale) | Levier de conversion, dans le respect de la charte comms |
| P1-6 | **Durcir `/api/stages/.../inscrire`** (rate-limit/CAPTCHA) avant campagne marketing | Exposition aux écritures de masse |

### P2 — Dette de fond & visibilité (à dérouler après stabilisation)

| # | Action | Pourquoi |
|---|--------|----------|
| P2-1 | Consolidations de modèles : supprimer StudentReport (après vérif table vide), StageBilan→Bilan, EamProgress/NsiPracticeProgress→SubjectProgress | Réduire la surface et les divergences (DOC-5 lots 2, 9–11, non destructifs) |
| P2-2 | **JSON-LD / schema.org** (EducationalOrganization, Course/Offer) + audit couverture sitemap | Rich results et visibilité locale Tunis |
| P2-3 | Synchronisation `coachId` à la fin d'affectation (R5) | Éliminer les records orphelins |
| P2-4 | Vue de **supervision** (crons, audit, ARIA, entitlements) pour l'admin | Observabilité opérationnelle |
| P2-5 | Définir un **environnement de staging** (ou substitut dump→restore) | Prérequis des lots avec migration (DOC-5 lots 3, 9–11) |

### Discipline d'exécution (non négociable, déjà rodée)

Chaque lot : branche fraîche depuis `main` → **gate canonique complet** (lint → typecheck → test → test:e2e → build → audit:site-map → check:docs-archive → git diff --check) → merge ff-only → déploiement. Aucun commit direct sur `main`. Migrations non destructives (tables conservées, backfill idempotent, vérification d'intégrité avant bascule, rollback prévu). Aucun état déclaré sans la donnée qui le prouve ; « c'est vert » n'a de valeur que si le gate complet a tourné et que sa sortie est montrée.

---

## 11. Ce qui est déjà engagé (à ne pas re-prescrire)

Pour éviter toute redondance : le corpus DOC-1 à DOC-5 fournit déjà l'inventaire prouvé, la cartographie des incohérences, la spec des dashboards, la couche de gestion cible et le plan de migration en 11 lots. Le lot 1 est livré (avec la réserve perf P0-2). Le présent audit s'y adosse et ajoute la lecture growth/marketing/SEO/UX ainsi que la priorisation unique « mise au point ». La décision R2 (P0-1) reste à la main du fondateur ; tout le reste est séquençable sous la discipline ci-dessus.
