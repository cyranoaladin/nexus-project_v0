
# Audit senior de production — Nexus Réussite

**Date :** 17 juin 2026  
**Périmètre :** dépôt `cyranoaladin/nexus-project_v0` + arborescence de production fournie (`arborescence_nexusreussite_production.txt`)  
**Nature de l’audit :** audit statique senior full-stack, produit, business model, qualité, sécurité et exploitation.

> Limite assumée : cet audit ne remplace pas un accès SSH au serveur, un dump contrôlé de la base, les variables `.env` réelles, les logs Nginx/PM2/Docker réels, ni des tests dynamiques authentifiés sur chaque rôle. Il établit néanmoins une cartographie solide des risques à partir du dépôt et de l’arborescence de production.

---

## 1. Verdict exécutif

Nexus Réussite dispose d’une base produit ambitieuse et différenciante : plateforme Next.js, dashboards par rôle, moteur d’abonnements, paiements, facturation, documents, IA pédagogique ARIA, RAG, Nexus Pedagogy Cockpit, worker IA, bilans, stages, programmes interactifs et outillage QA. La surface fonctionnelle est nettement supérieure à celle d’un simple site vitrine.

Le point faible majeur n’est pas le manque de fonctionnalités. C’est l’accumulation de systèmes parallèles, parfois partiellement intégrés : paiement manuel vs entitlements, RAG Chroma vs pgvector vs OpenAI embeddings, RBAC déclaratif vs guards manuels, Nginx Docker vs Nginx hôte, rate limiting mémoire vs Redis/Upstash, IA ARIA vs NPC/Chutes/Ollama/OpenAI.

**Décision recommandée :**
- **Bêta contrôlée : acceptable**, avec comptes connus, support humain et paiement manuel maîtrisé.
- **Go-live large : non recommandé** tant que les P0/P1 ci-dessous ne sont pas clôturés.
- **Priorité stratégique : geler les nouvelles fonctionnalités pendant un cycle court de consolidation.** Le produit a dépassé le stade “prototype” ; il doit maintenant entrer dans une phase d’industrialisation.

---

## 2. Périmètre technique observé

### 2.1 Stack principale

- **Frontend / backend :** Next.js App Router, React, TypeScript, API routes.
- **Auth :** NextAuth v5, credentials, JWT.
- **DB :** PostgreSQL + extension vector, Prisma.
- **Infra :** Docker Compose prod, Dockerfile prod multi-stage, réseau Docker externe, Postgres, app standalone, worker NPC.
- **Proxy :** Nginx hôte déclaré dans compose, Nginx complet aussi présent dans le dépôt.
- **IA :**
  - ARIA via OpenAI SDK.
  - RAG via ingestor FastAPI / ChromaDB selon `rag-client.ts`.
  - NPC worker via Chutes.ai pour OCR, diagnostic, matrices, remédiations.
  - Variables et docs mentionnant aussi Ollama/OpenAI/pgvector.
- **Business model :** offres de stages, seuils d’ouverture, coûts professeurs, audit de marge.
- **QA :** Jest, Playwright, scripts de sécurité, inventaire de routes API, audits antérieurs, Lighthouse/captures dans l’arborescence prod.

### 2.2 Taille de la surface

L’arborescence fournie fait apparaître environ :
- **753 dossiers**
- **2385 fichiers**
- **173 fichiers `route.ts`**
- **121 pages `page.tsx`**
- **222 fichiers Markdown**
- **68 PDF**
- **128 PNG**
- **40 migrations SQL**

Cette masse impose une gouvernance stricte. Une plateforme de cette taille ne peut plus être maintenue par revue manuelle opportuniste ; elle nécessite des contrats, des inventaires générés, des tests bloquants et des runbooks.

---

## 3. Matrice de sévérité

| Niveau | Signification | Décision |
|---|---|---|
| P0 | Risque de sécurité, finance, données élèves, disponibilité ou incohérence produit majeure | Bloquant avant ouverture large |
| P1 | Dette forte pouvant causer incidents, support coûteux ou régression | À corriger avant bêta élargie |
| P2 | Dette qualité, performance, UX ou maintenabilité | Plan 30 jours |
| P3 | Amélioration de confort ou polish | Backlog produit |

---

## 4. P0 — Points bloquants

### P0-01 — La protection API n’est pas uniformément centralisée

Le middleware protège surtout les pages `/dashboard`, `/admin`, `/student`, `/parent`, `/coach`, mais le matcher exclut explicitement les routes `/api`. Donc toute route API doit être sécurisée individuellement.

Risque :
- Une route dynamique oubliée peut exposer un bilan, une facture, un document, un rapport IA ou une donnée élève.
- L’existence d’un inventaire statique de guards confirme que la surface est suffisamment large pour nécessiter une politique systématique.

Correction :
1. Toutes les routes API sensibles doivent commencer par un helper unique :
   - `requireAuth`
   - `requireAnyRole`
   - `requireOwnership`
   - `requireFeatureApi`
   - `guardRateLimit` / `guardRateLimitAsync`
2. Interdire les guards manuels non standard hors exception documentée.
3. Ajouter un test CI qui échoue si une route sensible ne contient pas un guard reconnu.
4. Pour chaque route `[id]`, ajouter un test IDOR négatif : utilisateur A ne peut pas lire/modifier la ressource de B.

---

### P0-02 — `allowOwner` existe dans RBAC mais n’est pas réellement appliqué par `enforcePolicy`

Le fichier RBAC contient une notion `allowOwner`, mais `enforcePolicy` se limite à vérifier les rôles autorisés. L’ownership doit donc être fait ailleurs, manuellement, route par route.

Risque :
- Les développeurs peuvent croire que `allowOwner: true` suffit.
- Une route peut passer le contrôle de rôle sans vérifier que la ressource appartient bien à l’utilisateur.

Correction :
- Créer des helpers dédiés :
  - `requireParentOwnsStudent(parentUserId, studentId)`
  - `requireCoachAssignedToStudent(coachUserId, studentId)`
  - `requireStudentOwnsResource(studentUserId, resourceId)`
  - `requireParentOwnsInvoice(parentUserId, invoiceId)`
- Ne jamais utiliser `allowOwner` comme simple annotation.
- Faire échouer ESLint/CI si une route dynamique sensible ne contient aucun ownership explicite.

---

### P0-03 — Un enfant peut être créé avec le mot de passe du parent

La route `POST /api/parent/children` récupère le mot de passe hashé du parent et le réutilise pour créer le compte élève.

Risque :
- Confusion parent/enfant.
- Compromission croisée.
- Problème RGPD/mineurs.
- Mauvais modèle d’identité : un élève doit avoir son propre flux d’activation ou un accès sans mot de passe direct, selon l’âge et l’organisation.

Correction :
- Supprimer la réutilisation du mot de passe parent.
- Créer l’élève en état non activé.
- Envoyer un token d’activation spécifique, expirant, hashé côté base.
- Option : accès parent-proxy aux données enfant sans transformer le parent en élève.
- Migration : forcer reset/activation des comptes créés par l’ancien flux.

---

### P0-04 — Paiement, facture et entitlements ne sont pas encore alignés

Le moteur d’entitlements est bien pensé : il s’appuie sur `InvoiceItem.productCode`, `PRODUCT_REGISTRY`, `beneficiaryUserId` et des modes `SINGLE`, `EXTEND`, `STACK`.

Mais le flux de validation manuelle du paiement :
- génère une facture avec un item sans `productCode`,
- place `beneficiaryUserId` sur le `payment.userId`, donc vraisemblablement le parent, pas nécessairement l’élève bénéficiaire,
- active surtout l’ancien modèle `Subscription` + crédits,
- et l’intégration ClicToPay retourne encore `501`.

Risque :
- Un paiement peut être marqué payé sans entitlement canonique.
- Les abonnements historiques et les entitlements peuvent diverger.
- Le support ne saura pas quelle source est la vérité.
- Les add-ons ARIA et les accès plateforme peuvent devenir incohérents.

Correction :
1. Décider la source de vérité : `Invoice → InvoiceItem.productCode → Entitlement`.
2. Lors d’un paiement validé :
   - créer ou rattacher une facture complète,
   - renseigner `beneficiaryUserId` = user de l’élève bénéficiaire,
   - renseigner `productCode` sur chaque ligne,
   - appeler `activateEntitlements(invoiceId, tx)` dans la transaction.
3. Mettre l’ancien `Subscription` en projection dérivée ou le déprécier progressivement.
4. Interdire une facture payée sans `productCode` lorsqu’elle ouvre un droit produit.
5. Garder ClicToPay désactivé publiquement tant que init/webhook ne sont pas finalisés.

---

### P0-05 — Le RAG a plusieurs vérités techniques incompatibles

On observe trois représentations concurrentes :
- `rag-client.ts` déclare ChromaDB comme backend canonique, embeddings `nomic-embed-text`, 768 dimensions, pgvector désactivé.
- `schema.prisma` conserve `PedagogicalContent.embedding_vector` avec commentaire 1536 dimensions.
- `.env.production.example` et le compose mentionnent OpenAI embeddings `text-embedding-3-large` et `VECTOR_DIM=3072`.

Risque :
- Ingestion impossible ou silencieusement incohérente.
- Recherches RAG faibles.
- Données anciennes dans pgvector, nouvelles dans Chroma, sans cohérence.
- Diagnostics IA non reproductibles.

Correction :
- Rédiger un ADR unique : **RAG backend canonique**.
- Choisir :
  - soit ChromaDB/nomic 768,
  - soit pgvector/OpenAI 3072,
  - mais pas trois chemins actifs.
- Supprimer ou marquer deprecated les champs inutilisés.
- Aligner `RAG_INGESTOR_URL`, `VECTOR_DIM`, docs, tests, healthcheck et worker.
- Ajouter un test d’intégration RAG : requête connue → source attendue → score minimal.

---

### P0-06 — CSP, permissions navigateur et vidéo ne sont pas cohérentes

La CSP applicative et la configuration Nginx autorisent encore `unsafe-inline` et `unsafe-eval`. Par ailleurs, la `Permissions-Policy` désactive caméra et microphone, alors que Jitsi est prévu pour les sessions vidéo.

Risque :
- Surface XSS augmentée.
- Parcours vidéo potentiellement cassé.
- Sécurité difficile à raisonner si Nginx et app émettent des headers différents.

Correction :
- Définir un seul responsable CSP : application ou Nginx, pas les deux.
- Créer des headers par route :
  - défaut strict pour site public,
  - exception contrôlée pour Jitsi/session vidéo,
  - exception contrôlée pour l’app devis si réellement nécessaire.
- Plan nonce/hash pour supprimer progressivement `unsafe-inline`.
- Supprimer `unsafe-eval` sauf justification technique précise et testée.

---

### P0-07 — Go-live large non recommandé tant que RGPD, logs, backups, monitoring ne sont pas prouvés

Un audit go-live antérieur concluait déjà : bêta contrôlée oui, go-live large non recommandé. Les raisons restent cohérentes avec l’état observé :
- données mineurs,
- conversations IA,
- documents et PDFs,
- logs potentiellement sensibles,
- backups/restauration non prouvés,
- monitoring partiel,
- paiement carte non finalisé.

Correction :
- Cartographie RGPD : finalités, bases légales, durée de conservation, sous-traitants IA.
- Procédure DSAR : export, rectification, suppression.
- Restauration testée : DB + documents + uploads.
- Alerting : 5xx, DB, disque, SMTP, RAG, NPC worker, file storage.
- Redaction logs centralisée.

---

## 5. P1 — Dettes fortes

### P1-01 — Build permissif

`next.config.mjs` ignore ESLint pendant le build. Le script `lint` autorise un nombre très élevé d’avertissements. C’est compréhensible en phase de stabilisation, mais dangereux en production.

Correction :
- Réduire le seuil d’avertissements par paliers.
- Interdire `any`, `console.error` brut et routes sans guard dans les zones sensibles.
- CI bloquante sur sécurité et types.

---

### P1-02 — Rate limiting encore hétérogène

Le rate limiting existe, mais il y a plusieurs couches :
- Nginx,
- helper synchrone mémoire,
- helper async Redis/Upstash,
- wrappers dépréciés,
- routes utilisant des variantes différentes.

Correction :
- Pour les routes publiques et IA : `guardRateLimitAsync` avec Redis/Upstash obligatoire en production.
- Pour les routes authentifiées : clé par `userId` + suffixe route.
- Pour login/reset : bucket strict + anti-enumeration.

---

### P1-03 — ARIA manque d’un garde coût/qualité explicite

ARIA vérifie l’accès élève et l’entitlement, et limite le message à 1000 caractères. Mais l’appel IA ne montre pas de budget token quotidien/mensuel, de quota par élève, ni de journalisation coût/usage complète.

Correction :
- Table `AiUsageLedger`.
- Quotas par plan.
- Blocage doux avant dépassement.
- Logs coût sans contenu PII.
- Prompts versionnés et testés.

---

### P1-04 — Les prompts ARIA sont dupliqués

`lib/aria.ts` et `lib/aria-streaming.ts` dupliquent le prompt système. Cela crée une dérive possible entre réponse normale et streaming.

Correction :
- Créer `lib/aria/prompt.ts`.
- Versionner le prompt.
- Ajouter tests snapshot sur structure des messages.

---

### P1-05 — Le worker NPC est utile mais doit être opéré comme un service critique

Le worker réclame des jobs, traite OCR/diagnostics/matrices/remédiations, gère retry/backoff et libère les jobs au shutdown. C’est une bonne base. Mais il faut compléter :
- healthcheck réel du worker,
- dead-letter queue,
- timeout provider,
- alerte jobs bloqués,
- traçabilité coût tokens,
- purge/rétention des copies OCR.

---

### P1-06 — Les fichiers générés et documents runtime ne doivent pas vivre dans le dépôt de production

L’arborescence montre des factures PDF, captures, audits, rapports, fichiers de build, caches et fichiers générés. Sur un serveur, certains peuvent exister, mais il faut distinguer :
- dépôt source,
- artefact de build,
- stockage applicatif,
- backups,
- logs,
- captures d’audit.

Correction :
- Déploiement par artefact minimal.
- `/var/lib/nexus/uploads`
- `/var/lib/nexus/documents`
- `/var/log/nexus`
- backups hors repo.
- Aucun `.env`, `.git`, PDF facture ou upload dans l’arborescence web servie.

---

## 6. Audit par domaine

### 6.1 Architecture

Points forts :
- Organisation modulaire riche.
- Next.js standalone.
- Dockerfile prod non-root.
- Migration Prisma séparée.
- Worker NPC isolé.
- Healthcheck DB simple.
- Nombreux tests et scripts d’audit.

Faiblesses :
- Trop de systèmes parallèles.
- Documentation parfois en avance ou en retard sur le code.
- Multiplication des conventions : `student`, `eleve`, `assistant`, `assistante`, `admin`, `coach`, `parent`.
- Plusieurs sources de vérité métier.

Décision :
- Mettre en place un **Architecture Decision Register** obligatoire.

---

### 6.2 Frontend / UI / UX

Points forts :
- Identité premium identifiable.
- Fonts locales.
- SEO global, OpenGraph, JSON-LD.
- Skip link accessibilité.
- Pages publiques nombreuses : offres, stages, bilan gratuit, ARIA, équipe, centre, contact.
- Dashboards par rôle.

Faiblesses :
- Optimisation image désactivée.
- Trop de composants marketing concurrents.
- Anciennes pages statiques HTML présentes en parallèle.
- Risque d’incohérence entre homepage, offres, stages, flyers et pricing réel.
- Dashboard dense pour parents/assistante/coach : besoin de parcours critiques testés.

Actions :
- Design system unique.
- Matrice pages → CTA → offre → paiement → entitlement.
- Tests Playwright mobile pour 5 parcours :
  1. lead bilan gratuit,
  2. réservation stage,
  3. parent ajoute enfant,
  4. élève utilise ARIA,
  5. assistante valide paiement.

---

### 6.3 Backend / API

Points forts :
- Beaucoup de routes ont `zod`, `requireRole`, `requireFeatureApi`, `auth()`, ownership local.
- Inventaire de guards existant.
- Plusieurs endpoints ont des protections sérieuses.

Faiblesses :
- Guards hétérogènes.
- Trop de routes dynamiques P0/P1 selon inventaire statique.
- Ownership non encapsulé.
- Routes publiques de génération/diagnostic à surveiller.

Actions :
- `apiGuard()` standard obligatoire.
- Un registre route → policy → ownership → rateLimit.
- Génération automatique d’un rapport CI.

---

### 6.4 Base de données

Points forts :
- Prisma riche.
- Index nombreux.
- Idempotence paiement/credits notée.
- Contraintes d’unicité.
- 2FA admin prévue.
- Relations métier étendues.

Faiblesses :
- Modèles historiques et nouveaux en parallèle.
- `Subscription` + `Entitlement` coexistants sans source de vérité nette.
- `Session` et `SessionBooking` coexistent.
- RAG pgvector partiellement déprécié mais encore dans schema.
- JSON nombreux à typage métier fragile.

Actions :
- Cartographie modèle canonique.
- Dépréciation formelle des modèles legacy.
- Migrations de consolidation.
- Tests DB d’intégrité : paiement, facture, entitlement, crédit, session.

---

### 6.5 Paiement / facturation

Points forts :
- Validation manuelle atomique.
- Facture PDF générée.
- Document parent créé.
- Idempotence partielle sur payment update.
- ClicToPay prévoit HMAC.

Faiblesses :
- ClicToPay non opérationnel.
- Webhook TODO.
- Entitlements non branchés au flux de paiement actuel.
- Product codes absents dans facture auto-générée.
- Rejet sans notification client.

Actions :
- Garder carte désactivée.
- Formaliser virement manuel.
- Ajouter double validation au-dessus d’un seuil.
- Unifier invoice/payment/entitlement.

---

### 6.6 RAG / LLM / ARIA / NPC

Points forts :
- RAG client avec timeout.
- Fallback vide en cas d’erreur RAG.
- ARIA enregistre conversations et feedback.
- Ownership conversation ARIA respecté.
- NPC worker asynchrone avec retry/backoff.
- Validation JSON des sorties NPC.

Faiblesses :
- Backend RAG ambigu.
- Prompts non centralisés.
- Budget IA non visible.
- Health IA/RAG absent du healthcheck public.
- Chutes/Ollama/OpenAI cohabitent sans ADR runtime.
- NPC_LLM_MODE par défaut `stub`, à vérifier en prod.

Actions :
- ADR IA/RAG.
- Ledger d’usage IA.
- Health interne IA/RAG/NPC.
- Tests de non-régression pédagogique.
- Rétention et minimisation des contenus envoyés aux providers.

---

### 6.7 Nginx / Docker / exploitation

Points forts :
- Dockerfile prod multi-stage.
- App non-root.
- Healthcheck Docker.
- Postgres sans port public exposé.
- Nginx contient compression, TLS, rate limiting, dotfile blocking.

Faiblesses :
- Compose prod indique Nginx hôte, mais conf Nginx complète existe dans repo.
- App mappe `3001:3000`; vérifier bind réel.
- CSP existe côté app et Nginx : risque de divergence.
- Healthcheck limité à DB.
- Redis/rate limiting distribué non garanti selon env.

Actions :
- Documenter la config Nginx réellement active.
- Smoke test après déploiement : headers, CSP, HSTS, bind, health.
- Endpoint `/api/internal/health` protégé : DB, SMTP, RAG, Redis, disk, worker.
- Runbook restore.

---

### 6.8 Business model / offres

Points forts :
- Offres structurées avec prix, heures, seuils, rôle portfolio.
- Coûts enseignants modélisés.
- Audit de rentabilité interne.
- Seuils d’ouverture explicites.
- Positionnement premium cohérent : humain + plateforme + IA.

Faiblesses :
- Prix, offres et entitlements ne semblent pas encore reliés par une chaîne canonique.
- Le product registry technique ne reflète pas nécessairement toutes les offres marketing.
- Offres “entry” ou “fragile” peuvent être utiles commercialement mais doivent être contrôlées.
- Le JSON-LD global affiche un ancien intervalle `150–990` alors que certaines offres stages dépassent 1000 TND.

Actions :
- Créer un catalogue canonique unique :
  - `Offer`
  - `ProductCode`
  - `Price`
  - `InvoiceItem`
  - `Entitlement`
  - `Feature`
- Chaque CTA doit pointer vers un produit traçable.
- Le marketing ne doit jamais afficher un tarif qui ne correspond pas à une source canonique.

---

### 6.9 SEO / analytics / conformité marketing

Points forts :
- `robots.ts` bloque dashboard, API, auth, session, test, studio.
- Sitemap dynamique avec pages publiques et stages visibles.
- Google Analytics présent.
- Metadata et JSON-LD présents.

Faiblesses :
- Consentement cookies/analytics non observé.
- JSON-LD à mettre à jour avec offres réelles.
- Pages anciennes ou statiques peuvent polluer la cohérence.
- SEO local Tunis/Mutuelleville à renforcer.

Actions :
- Consent banner conforme.
- SEO local : pages “cours maths Tunis”, “prépa bac français Tunis”, “NSI Tunis”, “Mutuelleville”.
- Mise à jour JSON-LD.
- Audit 404/redirect/canonical.

---

## 7. Feuille de route de correction

### 48 heures — P0

1. Désactiver publiquement tout paiement carte.
2. Supprimer la réutilisation du mot de passe parent → enfant.
3. Ajouter un garde CI sur routes API sensibles.
4. Créer helpers ownership canoniques.
5. Auditer les routes P0 de l’inventaire API.
6. Décider RAG canonique.
7. Vérifier la config Nginx réellement active.
8. Ajouter procédure temporaire : validation manuelle paiement + facture + accès.
9. Ajouter monitoring minimal 5xx + DB + disque.
10. Sauvegarde DB + documents + test restauration.

### 7 jours — P1

1. Brancher paiement → facture → productCode → entitlement.
2. Centraliser ARIA prompt + quotas IA.
3. Rate limiting distribué Redis/Upstash obligatoire pour public/IA.
4. Redaction logs.
5. Health interne détaillé.
6. Politique confidentialité + procédure données mineurs.
7. Smoke Playwright complet par rôle.
8. CI bloquante sur API guards.
9. Catalogue produit canonique.
10. ADR IA/RAG et ADR paiement.

### 30 jours — P2

1. Refactor routes legacy.
2. Nettoyage dépôt vs runtime.
3. Optimisation images.
4. CSP nonce/hash progressive.
5. Dashboard support assistante.
6. Reporting financier.
7. Observabilité worker NPC.
8. Tests pédagogiques ARIA/RAG.
9. SEO local.
10. Design system final.

---

## 8. Definition of Done avant go-live large

Le go-live large ne doit être autorisé que si :

- 0 route API sensible sans auth + rôle + ownership.
- 0 compte élève partageant le mot de passe parent.
- 100 % des paiements donnant accès à un produit génèrent un entitlement.
- ClicToPay désactivé ou sandbox/production testé avec webhook idempotent.
- RAG backend unique documenté et testé.
- Health interne couvre DB, Redis, SMTP, RAG, NPC, disque.
- Backup et restore drill datés.
- Logs sans PII inutile.
- Politique confidentialité publiée.
- Consentement analytics traité.
- Smoke tests Playwright verts sur les parcours critiques.
- Runbook incident et responsable d’astreinte définis.
- Aucun `.env`, `.git`, PDF facture ou upload sensible dans le runtime web servi.
- Monitoring et alerting actifs.

---

## 9. Avis senior

Le produit a un potentiel réel : la combinaison **accompagnement humain premium + plateforme parents/élèves/coachs + IA pédagogique + bilans + cockpit pédagogique** est commercialement forte.

Mais le risque actuel est classique : une vitesse de construction très élevée a produit une plateforme riche, mais plusieurs couches ne sont pas encore consolidées. À ce stade, la priorité n’est plus d’ajouter des modules. La priorité est de rendre la plateforme **prouvable** : prouvable en sécurité, prouvable en paiement, prouvable en droits d’accès, prouvable en restauration, prouvable en qualité pédagogique.

La bonne décision technique et business est donc : **gel court des features, sprint de consolidation, puis réouverture progressive avec métriques de qualité.**

---

## 10. Prompt recommandé pour Codex

```text
Tu es lead senior full-stack, sécurité applicative et responsable qualité Nexus Réussite.

Objectif : transformer nexus-project_v0 en production fiable, auditée et cohérente, sans dette P0/P1.

Travail demandé :

1. Lire le rapport d’audit senior complet.
2. Créer une branche `hardening-prod-audit-2026-06-17`.
3. Corriger en priorité :
   - suppression de la réutilisation du mot de passe parent pour créer un compte élève ;
   - ajout d’un flux d’activation élève avec token hashé et expiration ;
   - centralisation de l’ownership RBAC ;
   - intégration paiement → facture → productCode → entitlement ;
   - désactivation explicite ClicToPay côté UI tant que init/webhook sont 501 ;
   - unification des prompts ARIA ;
   - ajout de rate limiting distribué obligatoire sur routes publiques/IA en production ;
   - ajout d’un healthcheck interne protégé DB/Redis/SMTP/RAG/NPC/disk ;
   - mise à jour de la documentation RAG pour choisir une seule source de vérité ;
   - durcissement des logs sans PII.
4. Ajouter les tests :
   - tests IDOR négatifs pour chaque route `[id]` sensible ;
   - tests paiement-entitlement ;
   - tests activation enfant ;
   - tests ARIA entitlement + quota ;
   - tests health interne ;
   - tests de non-régression sur routes publiques.
5. Ne pas ajouter de nouvelle fonctionnalité.
6. Produire un rapport final listant :
   - fichiers modifiés ;
   - risques traités ;
   - tests ajoutés ;
   - commandes exécutées ;
   - limites restantes.
7. La PR ne doit pas passer si :
   - une route API sensible est sans guard ;
   - un paiement payé ne produit pas l’accès canonique ;
   - un compte enfant reçoit le mot de passe parent ;
   - un secret ou fichier runtime sensible est inclus dans l’artefact.
```
