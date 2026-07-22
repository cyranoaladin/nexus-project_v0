# Rapport d’audit CTO / Full-stack / Growth — Nexus Réussite

**Périmètre :** dépôt `cyranoaladin/nexus-project_v0`, architecture applicative, logique métier, modèle économique, sécurité, dashboards, DB, API, déploiement et préparation go-live.
**Objectif :** établir l’état des lieux et poser la base du cahier des charges “go-live ready 100 %”.

---

## 0. Limite méthodologique

Je n’ai pas exécuté localement `npm run verify`, les tests Playwright, les migrations Prisma, ni inspecté la base de production réelle. L’audit ci-dessous repose sur les fichiers structurants du dépôt, les documents internes d’audit, les fichiers de configuration, le schéma Prisma, les pages publiques, la CI, Docker, RBAC, pricing, sécurité et routes API documentées.

Donc le verdict est un **audit décisionnel de code et d’architecture**, pas une certification runtime. Pour passer au “go-live ready 100 %”, il faudra compléter par une exécution contrôlée : build, tests, migrations, smoke tests authentifiés par rôle, backup/restore, audit RGPD et vérification du serveur réel.

---

# 1. Verdict exécutif

## 1.1. État global

Nexus Réussite n’est plus un simple site vitrine. Le dépôt contient une **plateforme SaaS éducative complète** : site marketing, tunnel de conversion, dashboards par rôle, auth, RBAC, entitlements, facturation, stages, documents, bilans, IA ARIA, RAG, évaluations, scoring, suivi parent, cockpit pédagogique et worker IA. Le README décrit explicitement une plateforme de pilotage éducatif combinant enseignants, dashboards, ARIA IA et rôles dédiés.

La stack est cohérente dans son ambition : **Next.js App Router, TypeScript, PostgreSQL + pgvector, Prisma, NextAuth, Docker, tests Jest/Playwright, IA/RAG, facturation, dashboards et CI structurée**.

## 1.2. Verdict CTO

| Axe                      |                                              État | Verdict                                                                        |
| ------------------------ | ------------------------------------------------: | ------------------------------------------------------------------------------ |
| Vision produit           |                                        Très forte | Nexus a une proposition différenciante réelle.                                 |
| Architecture métier      |                                 Riche, mais large | La plateforme couvre beaucoup de cas, au prix d’une forte complexité.          |
| Modèle économique        |                                    Bien structuré | Le pricing canonique est une force majeure.                                    |
| Sécurité API             |                           Sérieusement travaillée | Beaucoup de P0 ont été traités, mais l’audit humain final reste indispensable. |
| Déploiement              |                                       Exploitable | Docker/PM2/Nginx existent, mais la source de vérité infra doit être clarifiée. |
| Go-live marketing        | Possible après corrections de contenu et tracking | Le site public peut être activé rapidement.                                    |
| Go-live plateforme large |                      Non recommandé immédiatement | Les propres audits du dépôt maintiennent cette réserve.                        |
| Bêta contrôlée           |                                       Recommandée | Avec comptes connus, paiement maîtrisé et supervision humaine.                 |

La documentation sécurité interne indique clairement que le **go-live large n’est pas recommandé automatiquement** et reste conditionné à des validations produit, ops, RGPD et monitoring.

Mon avis : **la stratégie saine consiste à dissocier le go-live marketing du go-live applicatif complet**.

* **Go-live public / acquisition : oui**, après nettoyage des contenus, pricing, tracking et formulaires.
* **Go-live plateforme fermée : oui**, en bêta contrôlée.
* **Go-live large avec paiement, espace parent/élève/coach, IA, documents et bilans : non**, tant que les P0/P1 restants ne sont pas verrouillés opérationnellement.

---

# 2. Cartographie générale de la plateforme

## 2.1. Couches principales

| Couche                 | Contenu observé                                           | Commentaire                                                 |
| ---------------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| Front public           | Accueil, offres, stages, bilan gratuit, pages SEO         | Très utile pour acquisition et conversion.                  |
| Dashboards             | Admin, assistante, coach, parent, élève                   | Architecture multi-rôle déjà présente.                      |
| API routes             | 164 routes inventoriées dans l’audit sécurité             | Surface large, donc exigence forte de guards.               |
| Auth                   | NextAuth v5 credentials + JWT                             | Fonctionnelle, mais à renforcer sur 2FA et rate-limit auth. |
| RBAC                   | Matrice de permissions et policy map                      | Bonne base, mais ownership à auditer route par route.       |
| DB                     | Prisma + PostgreSQL + pgvector                            | Modèle riche, mais plusieurs doubles sources de vérité.     |
| Pricing                | `pricing.canonical.json`                                  | Très bonne source unique de vérité.                         |
| IA / ARIA / NPC        | ARIA, RAG, assessments, diagnostics, bilans, worker NPC   | Très différenciant, mais lourd à industrialiser.            |
| Paiement / facturation | Bank transfer, ClicToPay partiel, invoices, entitlements  | À finaliser avant paiement carte.                           |
| Infra                  | Docker Compose prod, Dockerfile, PM2/Nginx hôte documenté | Fonctionnel mais gouvernance infra à clarifier.             |
| QA                     | Jest, Playwright, CI, sécurité                            | Base solide.                                                |

---

# 3. Stack technique

## 3.1. Stack déclarée

Le README présente une stack moderne : Next.js 15, React, TypeScript, Tailwind, NextAuth v5, Prisma, PostgreSQL + pgvector, Ollama/OpenAI SDK, RAG, Nodemailer, Telegram, Zod, Zustand, Recharts, PDFKit/react-pdf, Jest, Playwright, GitHub Actions et Docker.

Le `package.json` confirme une application Next/React/TypeScript avec Prisma, NextAuth beta, Tailwind v4, Radix, Zod, bcryptjs, OpenAI SDK, PDF tooling, Playwright, Jest et scripts de validation.

## 3.2. Points techniques à surveiller

| Sujet                | Observation                                                                 | Risque                                                                  |
| -------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Next.js / ESLint     | `next.config.mjs` ignore ESLint pendant le build                            | Un build peut passer avec dette lint.                                   |
| Prisma               | Le projet utilise Prisma avec PostgreSQL et extension `vector`              | Cohérent pour RAG, mais dimensions et backend RAG doivent être alignés. |
| React / types        | React 18, mais écosystème typage et packages à surveiller                   | Risque de dette typecheck selon versions.                               |
| NextAuth v5 beta     | Auth moderne mais dépendante d’une beta                                     | Acceptable, mais nécessite tests de régression stricts.                 |
| Docker / PM2 / Nginx | Deux visions infra coexistent : Docker Compose et Nginx/PM2 hôte documentés | Décision infra à figer avant go-live large.                             |

---

# 4. Architecture applicative

## 4.1. Organisation générale

Le README décrit une architecture large avec :

* `app/` pour pages, API routes, auth, dashboard ;
* `components/` pour UI, sections, dashboards, stages ;
* `lib/` pour RBAC, guards, crédits, sessions, entitlements, invoices, diagnostics, assessments, ARIA, RAG, bilans, stages, trajectoires ;
* `prisma/` pour le schéma et migrations.

La documentation interne indique une surface importante : plus de 100 routes API, dashboards par rôle, moteurs métier, IA et tests.

## 4.2. Lecture architecturale

Nexus a trois produits dans un seul dépôt :

1. **Produit marketing**

   * acquisition ;
   * offres ;
   * stages ;
   * candidat libre ;
   * bilan gratuit ;
   * conversion WhatsApp / lead.

2. **Produit opérationnel**

   * gestion élèves ;
   * parents ;
   * coachs ;
   * sessions ;
   * documents ;
   * factures ;
   * stages ;
   * bilans.

3. **Produit IA / pédagogique**

   * ARIA ;
   * RAG ;
   * diagnostics ;
   * assessments ;
   * SSN/UAI ;
   * NPC ;
   * rapports pédagogiques.

Cette ambition est forte, mais elle crée un risque : **la plateforme est plus avancée fonctionnellement qu’elle ne l’est probablement en gouvernance d’exploitation**. Il faut donc réduire le scope go-live.

---

# 5. Frontend public et conversion

## 5.1. Accueil

La page d’accueil est construite autour d’un client component `HomePageClient`, avec navigation corporate, hero, router par niveau, enjeux, méthode, tarifs, réassurance, FAQ, témoignages et CTA bilan gratuit.

Points positifs :

* positionnement premium ;
* router par niveau : Terminale, Première, Seconde, Troisième, Candidat libre ;
* CTA vers `/bilan-gratuit` et WhatsApp ;
* éléments de confiance : enseignants agrégés/certifiés, bacs blancs, groupes réduits, plateforme ARIA, bilans parents, carte d’examen, Cyclades, AEFE.

Point d’attention :

* la page est très orientée client component ; il faut surveiller performance, bundle JS et Core Web Vitals ;
* les testimonials sont masqués si la donnée est vide, ce qui est sain, mais il faut alimenter une preuve sociale réelle ;
* le tracking GA est codé directement dans `app/layout.tsx`, avec ID `G-3XPB54QL5N`, sans gestion explicite du consentement dans le fichier inspecté.

## 5.2. Page offres

La page `/offres` est bien structurée : elle s’appuie sur le pricing canonique, présente les catégories `annual`, `libre`, `plateforme`, `intensifs`, `ponctuel`, `coaching`, `pass`, `carte`, et organise les offres en méga-parcours.

Points forts :

* transparence TND ;
* groupes maximum ;
* acompte 30 % ;
* échéanciers ;
* lien direct vers bilan gratuit avec `offer` dans l’URL ;
* bonne segmentation : scolarisé, candidat libre, plateforme.

Point à corriger avant campagne :

* vérifier que toutes les pages publiques utilisent **exclusivement** les données `pricing.canonical.json` ;
* supprimer tout ancien montant durcodé ;
* contrôler que les visuels sociaux ne promettent pas un prix inférieur au canon.

## 5.3. Page stages

La page `/stages` charge le calendrier depuis `getStageCalendar`, les formats, les prix validés et les règles.

La page stages présente :

* stages 2026/2027 ;
* groupes réduits ;
* format demi-journée de 3 h ;
* matières Maths, NSI, Français EAF, Philo ;
* public AEFE et candidats libres ;
* pré-inscription ;
* WhatsApp ;
* lien vers formats et tarifs.

Le calendrier canonique inclut notamment la **Pré-Rentrée du 24 au 28 août 2026**, format intensif 15 h, pour élèves AEFE et candidats libres, en Maths, NSI, Français et Philo.

C’est cohérent avec la stratégie marketing de prérentrée.

---

# 6. Modèle économique et pricing

## 6.1. Point fort majeur : source unique de vérité

Le fichier `data/pricing.canonical.json` est explicitement marqué comme **source de vérité unique** des prix, effectifs, acomptes et échéanciers. Il indique aussi qu’aucun montant TND ne doit être codé en dur dans les composants ou pages.

C’est une excellente décision produit. Elle permet :

* cohérence entre site, offres, devis, factures ;
* tests automatiques ;
* réduction des erreurs commerciales ;
* changement de pricing centralisé ;
* alignement avec la logique de marge.

## 6.2. Règles commerciales

Les règles canonisées sont claires :

| Règle                 |    Valeur |
| --------------------- | --------: |
| Semaines par an       |        30 |
| Groupe maximum        |         5 |
| Ouverture lycée       |         3 |
| Ouverture collège     |         4 |
| Ouverture stage       |         3 |
| Acompte               |      30 % |
| Remise comptant       |       5 % |
| Remise fratrie        |      10 % |
| Remise ancien élève   | 10 à 18 % |
| Plafond global remise |      20 % |
| Remises cumulables    |       Non |

Ces règles sont documentées dans le pricing canonique.

## 6.3. Offres annuelles

Les offres couvrent :

* Terminale spécialité simple ;
* Terminale Duo ;
* Terminale Excellence ;
* Première EAF ;
* Première Maths anticipées ;
* Première Double Sécurité ;
* Première Sciences ;
* Seconde ;
* Troisième ;
* candidats libres ;
* plateforme ARIA.

Les candidats libres sont bien pris en compte :

| Offre candidat libre       | Prix annuel |
| -------------------------- | ----------: |
| Première Libre Essentiel   |   1 900 TND |
| Première Libre Accompagnée |   4 900 TND |
| Terminale Libre Online     |   2 900 TND |
| Terminale Libre Mixte      |   7 900 TND |
| Terminale Libre Premium    |   9 900 TND |

Ces offres apparaissent dans le pricing canonique.

## 6.4. Stages et produits d’appel

Le pricing canonique indique notamment :

| Stage / format   | Volume |      Prix |
| ---------------- | -----: | --------: |
| Express vacances |    9 h |   420 TND |
| Intensif Solo    |   12 h |   580 TND |
| Intensif Renfort |   15 h |   720 TND |
| Intensif Duo     |   18 h |   850 TND |
| Sprint Final Max |   30 h | 1 450 TND |

Le repère tarifaire canonique indique `stagesBase : dès 420 TND`.

Décision marketing : **ne plus communiquer “dès 350 TND” si le canon actuel dit 420 TND**. Toute campagne Facebook/Instagram doit s’aligner sur `dès 420 TND`, sauf décision formelle de modifier le pricing canonique.

## 6.5. Pass et Carte Nexus

Le modèle comprend :

* Pass Intensifs Première ;
* Pass Intensifs Terminale ;
* Pass Candidat Libre ;
* Pass Grand Oral & Sprint ;
* Pass Excellence ;
* Carte Nexus à 290 TND/an.

La Carte Nexus est explicitement assumée comme loss-leader incluant ARIA Autonomie, remise 10 %, priorité de réservation et diagnostic stratégique offert.

Mon avis : **la Carte Nexus est un très bon produit d’entrée** pour convertir les leads hésitants qui ne sont pas encore prêts à prendre une formule annuelle.

---

# 7. Modèle métier pédagogique

## 7.1. Entités principales

Le schéma Prisma montre une logique métier avancée autour de :

* `User` ;
* `ParentProfile` ;
* `Student` ;
* `CoachProfile` ;
* `Subscription` ;
* `CreditTransaction` ;
* `Session` ;
* `SessionBooking` ;
* `AriaConversation` ;
* `Stage` ;
* `StageReservation` ;
* `StageBilan` ;
* `Diagnostic` ;
* `Assessment` ;
* `Bilan` ;
* `Invoice` ;
* `Entitlement` ;
* `UserDocument` ;
* `MathsProgress` ;
* `NsiPracticeProgress` ;
* `CoachStudentAssignment`.

## 7.2. Point fort

Le modèle `Student` est clairement conçu comme une entité métier centrale, avec niveau, filière, spécialités, établissement, crédits, sessions, bilans, trajectories, stages, assessments, coach assignments et rapports.

C’est une bonne base pour un véritable système de pilotage académique.

## 7.3. Dette métier majeure : doubles sources de vérité

Le schéma contient plusieurs systèmes parallèles :

| Domaine           | Systèmes parallèles                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Sessions          | `Session` et `SessionBooking`                                                                    |
| Bilans            | `Diagnostic`, `Assessment`, `StageBilan`, `Bilan` canonique                                      |
| Paiement / droits | `Subscription`, `Payment`, `Invoice`, `Entitlement`                                              |
| IA / RAG          | `PedagogicalContent.embedding_vector`, RAG externe, ARIA, NPC                                    |
| Progression       | `MathsProgress`, `EamProgress`, `NsiPracticeProgress`, `ProgressionHistory`, `ProjectionHistory` |

La documentation sécurité elle-même place en P2 la canonicalisation `SessionBooking` et `Bilan`, précisément parce que ces doubles sources peuvent diverger.

Décision CTO recommandée :

* **Session canonique : `SessionBooking`**.
* **Bilan canonique : `Bilan`**.
* **Droits produit canoniques : `Invoice → InvoiceItem.productCode → Entitlement`**.
* **Progression canonique : à définir par discipline, mais exposée via une abstraction commune.**

---

# 8. Authentification, RBAC et sécurité

## 8.1. Auth

Le fichier `auth.ts` utilise NextAuth credentials, bcrypt, Prisma et JWT. Il bloque les élèves non activés via `activatedAt`, compare le mot de passe avec bcrypt et enrichit le token/session avec rôle et identité.

Points positifs :

* bcrypt ;
* blocage des élèves non activés ;
* messages génériques ;
* JWT enrichi ;
* séparation des rôles.

Points à finaliser :

* rate-limit spécifique login à vérifier ;
* 2FA admin à vérifier : le schéma possède des champs TOTP, mais je n’ai pas vu dans les fichiers inspectés une enforcement complète au login. Le modèle `User` contient bien `totpSecret`, `totpEnabledAt`, `totpBackupCodes`, `totpLastUsedAt`.
* procédure de reset / activation à auditer finement.

## 8.2. Middleware

Le middleware protège les routes `/dashboard`, `/admin`, `/student`, `/parent`, `/coach`, redirige selon rôle et applique des security headers.

Mais les API sont exclues du matcher. Cela signifie que **chaque route API sensible doit être gardée individuellement**. Cette contrainte est confirmée par l’inventaire des guards API.

## 8.3. RBAC

Le fichier `lib/rbac.ts` constitue une bonne base : il définit ressources, actions, permissions par rôle et policies.

Rôles :

| Rôle       | Fonction                                                         |
| ---------- | ---------------------------------------------------------------- |
| ADMIN      | contrôle complet                                                 |
| ASSISTANTE | gestion opérationnelle élèves, coachs, abonnements, réservations |
| COACH      | suivi pédagogique, rapports, documents, élèves assignés          |
| PARENT     | enfants, bilans, paiements, réservations                         |
| ELEVE      | ressources, sessions, bilans, progression                        |

Le modèle est pertinent.

## 8.4. Point critique : ownership

Le fichier `lib/guards.ts` définit des fonctions d’ownership : parent possède l’élève, coach assigné à l’élève, élève propriétaire de ressource, parent propriétaire de facture.

Le problème n’est pas l’absence de helpers. Le problème est la nécessité de vérifier que **toutes les routes dynamiques sensibles les utilisent réellement**.

L’inventaire des guards API indique 164 routes, dont plusieurs P0 à auditer en priorité dans l’état statique initial.  La documentation de durcissement indique ensuite que plusieurs lots P0 ont été corrigés et déployés, mais maintient des risques résiduels et des validations humaines.

Décision : **aucun go-live large sans audit IDOR final route par route**.

## 8.5. Rate limiting

Le système de rate limit a été centralisé avec mémoire, Redis et Upstash. En production, le code signale comme critique le fait d’utiliser le mode mémoire sans Redis/Upstash.

La documentation sécurité indique que le rate-limit distribué est une condition de bêta élargie et que le mode Redis local n’était pas encore validé en production à ce moment.

Priorité P0/P1 :

* configurer Redis/Upstash réel ;
* vérifier `REDIS_URL` ou `UPSTASH_REDIS_REST_URL/TOKEN` ;
* exécuter tests 429 ;
* interdire le fallback mémoire en go-live large.

## 8.6. CSP / Permissions-Policy

Les security headers sont centralisés côté application. Le fichier `lib/security-headers.ts` inclut CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy et Permissions-Policy.

Mais la documentation sécurité signale encore des points P1 :

* `unsafe-inline` / `unsafe-eval` ;
* CORS ;
* Permissions-Policy qui peut casser Jitsi avec `camera=(), microphone=()`.

Décision : **ne pas ouvrir les sessions vidéo à grande échelle sans test Jitsi complet**.

---

# 9. API et routes sensibles

## 9.1. Inventaire

Le dépôt a un inventaire API de 164 routes. L’inventaire initial classait :

* P0 : 42 ;
* P1 : 38 ;
* P2 : 62 ;
* OK : 22.

Il précise que la lecture est statique et ne remplace pas un audit IDOR manuel.

## 9.2. Routes critiques

Les routes prioritaires concernaient notamment :

* factures admin ;
* stages admin ;
* sessions de stages ;
* assessments submit ;
* assignations assistante ;
* gestion coachs ;
* documents élèves.

Les documents de durcissement montrent que des lots ont été traités :

* payments / webhooks / subscriptions ;
* admin users / assistante students-coaches ;
* NPC reports/submissions/documents ;
* assessments ;
* stages reservations ;
* bilans/reports ;
* admin stages.

C’est un très bon signe : le projet a déjà une démarche de sécurité sérieuse.

## 9.3. Point de décision

Même si les lots sont documentés comme corrigés, le go-live large ne doit pas reposer sur la documentation seule.

Critères de validation :

* inventaire API régénéré ;
* zéro vrai P0 ouvert ;
* chaque route dynamique sensible a un test IDOR ;
* chaque route publique sensible a rate-limit distribué ;
* chaque route document/PDF a projection contrôlée ;
* aucun token brut, `localPath`, `password`, `activationToken`, `pdfPath`, `llmJson`, `contextJson` exposé.

---

# 10. Paiements, facturation, entitlements

## 10.1. Modèles disponibles

Le schéma inclut :

* `Payment` avec statut, méthode, externalId, metadata et preuve d’acceptation CGV ;
* `ClicToPayTransaction` ;
* `Invoice` ;
* `InvoiceItem` ;
* `Entitlement` ;
* `InvoiceAccessToken`.

C’est une architecture sérieuse.

## 10.2. Problème central

La documentation sécurité indique que ClicToPay n’était pas product-ready et que le paiement carte devait rester interdit tant que provider, signature, idempotence, montant et devise ne sont pas complets.

Donc :

* paiement manuel / virement : possible en bêta contrôlée ;
* paiement carte public : non, tant que ClicToPay n’est pas finalisé ;
* activation automatique des droits : à vérifier de bout en bout.

## 10.3. Source de vérité recommandée

La source de vérité financière doit être :

> **Invoice → InvoiceItem.productCode → Payment paid → Entitlement activated**

Tout autre système doit devenir une projection :

* `Subscription` : projection d’accès ;
* crédits : ledger séparé ;
* dashboards : lecture des entitlements / invoices.

---

# 11. IA, ARIA, RAG, NPC

## 11.1. ARIA

ARIA est intégrée dans le modèle :

* `AriaConversation` ;
* `AriaMessage` ;
* feature gating `aria_maths`, `aria_nsi` ;
* feedback utilisateur ;
* RAG / contenus pédagogiques.

Le README décrit ARIA avec Ollama/OpenAI SDK, RAG pgvector, pipeline de bilans et assistants spécialisés.

## 11.2. RAG

Le schéma Prisma contient `PedagogicalContent.embedding_vector` avec extension `vector`.

Mais la documentation de sécurité signale un risque de vérités techniques concurrentes : pgvector, Chroma, OpenAI embeddings, Ollama, FastAPI ingestor, dimensions différentes.

Décision CTO :

* rédiger un ADR RAG ;
* choisir un backend canonique ;
* aligner dimensions, ingestion, tests, healthcheck ;
* afficher ARIA seulement quand la chaîne réelle est disponible.

## 11.3. NPC worker

Le `docker-compose.prod.yml` contient un service `npc-worker` avec variables IA, RAG, Chutes API, mode LLM et polling.

La documentation sécurité signale que le worker NPC a un risque si `NPC_LLM_MODE=stub` masque une fonctionnalité non réelle.

Décision : **tout module IA non réellement opérationnel doit être masqué ou marqué bêta**.

---

# 12. Base de données et gouvernance des données

## 12.1. Richesse du modèle

Le schéma couvre :

* élèves mineurs ;
* parents ;
* coachs ;
* documents ;
* factures ;
* paiements ;
* bilans ;
* diagnostics ;
* assessments ;
* progressions ;
* IA ;
* tokens ;
* TOTP ;
* documents locaux.

C’est puissant, mais cela impose une gouvernance forte.

## 12.2. Données sensibles

Nexus manipule :

* données de mineurs ;
* emails et téléphones ;
* copies, bilans, documents ;
* données de paiement ;
* traces d’IA ;
* IP et user agent dans certains modèles ;
* tokens d’activation ;
* potentiellement fichiers locaux.

Les documents sont stockés via `UserDocument.localPath`, explicitement hors dossier public.

Bon choix, mais il faut compléter par :

* contrôle d’accès document par rôle ;
* antivirus upload ;
* taille maximale ;
* types MIME autorisés ;
* expiration ;
* suppression ;
* audit trail ;
* chiffrement ou stockage sécurisé.

## 12.3. Point spécifique : création enfant parent

La route `app/api/parent/children/route.ts` ne réutilise plus le mot de passe parent : elle crée désormais un élève inactif, `password: null`, avec token d’activation hashé et expiration 72 h.

C’est une correction importante.

Point à revoir : la réponse retourne le token brut au parent.
Ce n’est pas forcément interdit, mais c’est sensible. Je recommande :

* soit envoi uniquement par email sécurisé ;
* soit affichage unique avec audit trail ;
* soit activation déclenchée par l’assistante ;
* jamais de token brut dans logs ;
* expiration stricte ;
* possibilité de révocation.

---

# 13. CRM, leads et conversion

## 13.1. Contact lead

La route `/api/contact` utilise `guardRateLimitAsync`, parse le JSON, appelle `captureContactLead`, puis renvoie `leadId`.

Le service `captureContactLead` valide avec Zod, stocke `ContactLead`, et envoie une notification email interne. Il impose le consentement pour newsletter/callback/contact.

Points positifs :

* Zod ;
* rate-limit ;
* statut lead ;
* email notification ;
* consentement partiel ;
* source / interest / urgency.

À améliorer pour growth :

* ajouter `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` ;
* ajouter `meta_click_id`, `fbclid`, `ig_source` ;
* ajouter `landing_page`, `referrer`, `device`;
* ajouter pipeline : NEW → CONTACTED → QUALIFIED → BILAN_BOOKED → ENROLLED → LOST ;
* ajouter motif de perte ;
* ajouter date de relance ;
* ajouter assignation assistante ;
* intégrer WhatsApp comme canal CRM.

## 13.2. Bilan gratuit

Le bilan gratuit est le meilleur CTA de conversion. La documentation de site map le considère comme tunnel public de demande de bilan.

Décision growth :

> Le bilan gratuit doit devenir le centre de tout le funnel Meta Ads.

---

# 14. Infra, Docker, Nginx, déploiement

## 14.1. Docker Compose

Le `docker-compose.prod.yml` contient :

* `postgres` avec `pgvector/pgvector:pg15` ;
* `migrate` avec Prisma migrate deploy ;
* `nexus-app` ;
* `npc-worker` ;
* volumes DB, uploads, logs, storage ;
* healthcheck `/api/health` ;
* port host `3001:3000`;
* réseau externe `nexus-project_v0_nexus-network`.

Point positif : structure sérieuse.

Point à clarifier : le fichier indique que Nginx container est désactivé et que le Nginx est géré par l’hôte.

## 14.2. Dockerfile prod

Le `Dockerfile.prod` est multi-stage :

* deps ;
* builder ;
* migrator ;
* runner ;
* user non-root ;
* copie `.next/standalone`, static, public, prisma, fonts PDFKit ;
* healthcheck.

C’est bon.

## 14.3. Healthcheck

`/api/health` teste `SELECT 1` via Prisma et renvoie `ok` ou `503` sans détails internes.

C’est minimal mais correct.

À compléter :

* health DB ;
* health Redis ;
* health SMTP ;
* health RAG ;
* health NPC worker ;
* health file storage ;
* version Git / build SHA ;
* mode IA réel vs stub.

## 14.4. Nginx et runtime minimal

La documentation sécurité signale que des artefacts sensibles existaient physiquement dans le répertoire applicatif de production, même si Nginx les retournait en 404.

Un P0 a été corrigé côté Nginx, mais la migration vers un artefact runtime minimal reste une recommandation.

Décision DevOps :

* ne pas déployer un clone Git complet en prod ;
* déployer un artefact minimal ;
* `.env`, `.git`, `docs`, `scripts`, `prisma/schema.prisma` hors webroot ;
* vhost Nginx versionné ;
* rollback documenté ;
* backup avant chaque release.

---

# 15. CI/CD, tests et qualité

## 15.1. CI GitHub

La CI est sérieuse :

* lint ;
* typecheck ;
* unit tests ;
* integration tests PostgreSQL ;
* E2E Playwright ;
* security scan ;
* production build ;
* status check final.

La CI utilise aussi PostgreSQL pgvector en intégration et E2E, installe Playwright, seed la DB E2E, lance le serveur standalone et attend `/api/health`.

## 15.2. Problème

La sécurité est marquée comme informative dans le status final : le job security est explicitement “allowed to fail”.

Pour un go-live 100 %, ce n’est pas acceptable.

Décision :

* `npm audit high/critical` doit bloquer ;
* Semgrep secrets/security doit bloquer sur règles critiques ;
* OSV high/critical doit bloquer ;
* exceptions documentées seulement par fichier d’allowlist signé.

## 15.3. Build permissif

`next.config.mjs` ignore ESLint pendant le build.
C’est acceptable pour stabiliser une bêta, pas pour “go-live ready 100 %”.

---

# 16. UI/UX et design system

## 16.1. Points forts

Le front public utilise une identité premium :

* `luxury` classes ;
* bleu nuit ;
* doré ;
* typographies locales ;
* CTA clairs ;
* réassurance ;
* offres lisibles ;
* FAQ ;
* pages SEO.

Les pages offres et stages ont une structure cohérente avec le modèle économique.

## 16.2. Points faibles probables

| Sujet             | Risque                                              |
| ----------------- | --------------------------------------------------- |
| Client components | Bundle potentiellement lourd.                       |
| Dashboards riches | Dette accessibilité et cohérence UX.                |
| Design system     | Plusieurs familles de composants peuvent coexister. |
| Formulaires       | Risque de friction si trop longs.                   |
| Mobile            | À valider sur parcours parent réel.                 |
| Preuve sociale    | À documenter avec vrais témoignages.                |
| Analytics         | Besoin de tracking events + consentement.           |

Décision UI/UX :
**ne pas ajouter de nouvelles pages avant d’auditer les parcours principaux : accueil → offre → bilan → WhatsApp → inscription.**

---

# 17. Gouvernance produit

## 17.1. Risque principal

Le projet a grandi vite. Il contient :

* site marketing ;
* dashboards ;
* IA ;
* facturation ;
* RAG ;
* NPC ;
* stages ;
* exercices ;
* documents ;
* paiements ;
* CRM ;
* programmes disciplinaires.

Le risque n’est plus “manque de fonctionnalités”.
Le risque est :

> **trop de fonctionnalités partiellement industrialisées.**

## 17.2. Gouvernance recommandée

Créer quatre comités de décision, même petits :

| Comité              | Décisions                                   |
| ------------------- | ------------------------------------------- |
| Produit / pédagogie | offres, promesses, parcours, bilans         |
| Tech / sécurité     | API, RBAC, infra, données                   |
| Growth / commercial | campagnes, CRM, funnel, pricing             |
| Ops / support       | inscriptions, relances, factures, incidents |

Pour chaque fonctionnalité :

* owner ;
* statut : concept / bêta / production ;
* dépendances ;
* données manipulées ;
* tests ;
* monitoring ;
* rollback ;
* documentation support.

---

# 18. Go-live readiness

## 18.1. Score estimatif

| Domaine             | Score |
| ------------------- | ----: |
| Vision produit      |  90 % |
| Front public        |  80 % |
| Pricing             |  90 % |
| CRM lead capture    |  65 % |
| Auth / RBAC         |  75 % |
| API security        |  75 % |
| DB model            |  75 % |
| Payments            |  55 % |
| IA / RAG            |  55 % |
| Dashboards          |  65 % |
| Infra               |  70 % |
| Monitoring / backup |  45 % |
| RGPD / mineurs      |  45 % |
| CI / tests          |  80 % |

**Score go-live large estimé : 68–72 %.**

Le produit peut vendre et convertir.
La plateforme ne doit pas encore être ouverte largement sans verrouillage des P0/P1.

## 18.2. Décision de release

| Release                             | Autorisation                                  |
| ----------------------------------- | --------------------------------------------- |
| Site public acquisition             | Oui, après nettoyage contenu/pricing/tracking |
| Campagnes Meta Ads                  | Oui, vers bilan gratuit / WhatsApp            |
| Bêta plateforme avec comptes connus | Oui, sous supervision                         |
| Paiement carte public               | Non                                           |
| IA ARIA publique large              | Non, sauf périmètre bêta                      |
| Documents / bilans parents large    | Oui seulement après audit IDOR final et RGPD  |
| Go-live large “100 %”               | Non à ce stade                                |

---

# 19. Plan d’action P0 — avant toute ouverture large

## P0-1 — Verrouiller la sécurité API

**Objectif :** zéro route dynamique sensible sans guard + ownership.

Actions :

* régénérer l’inventaire API ;
* vérifier les 164 routes ;
* chaque `[id]` doit avoir un test IDOR ;
* chaque route publique sensible doit avoir rate-limit ;
* chaque réponse doit être projetée explicitement ;
* interdiction des `include: { user: true }` dans les routes sensibles si un `select` suffit.

Critère d’acceptation :

* inventaire final signé ;
* tests IDOR verts ;
* aucun vrai P0 ouvert ;
* sécurité CI bloquante.

## P0-2 — Rate limiting distribué réel

Le code supporte Redis/Upstash, mais le fallback mémoire reste un risque en production.

Actions :

* installer Redis local ou Upstash ;
* configurer `REDIS_URL` ou Upstash ;
* valider 429 ;
* vérifier que `RATE_LIMIT_DISABLE=1` ne peut pas désactiver en production ;
* monitorer les buckets.

Critère :

* mode runtime = `redis` ou `upstash`;
* tests routes publiques : contact, bilan, stage inscription, assessment submit, reset password.

## P0-3 — Paiement carte

Actions :

* soit désactiver complètement ClicToPay UI ;
* soit finaliser init + webhook + signature + idempotence + montant/devise ;
* ne jamais activer entitlement sans paiement validé ;
* tester double webhook ;
* tester mauvais montant ;
* tester mauvaise devise ;
* tester replay.

Critère :

* paiement carte non visible tant que tests non verts.

## P0-4 — Backup / restore

Actions :

* backup quotidien PostgreSQL ;
* backup uploads/documents ;
* chiffrement ou stockage sécurisé ;
* restauration sur DB temporaire ;
* runbook écrit ;
* test mensuel.

Critère :

* preuve de restauration, pas seulement preuve de backup.

## P0-5 — Monitoring / alerting

Actions :

* alert 5xx ;
* DB down ;
* Redis down ;
* SMTP fail ;
* disque > 80 % ;
* worker NPC down ;
* RAG down ;
* healthcheck enrichi.

Critère :

* alerte test reçue ;
* dashboard ops minimal.

## P0-6 — RGPD / mineurs

Actions :

* politique de confidentialité claire ;
* finalités de traitement ;
* durée de conservation ;
* sous-traitants IA ;
* procédure export/suppression ;
* droits parent/élève ;
* consentement analytics ;
* registre de traitement.

Critère :

* documentation juridique prête ;
* consentement analytics avant GA/Meta Pixel ;
* procédure DSAR documentée.

## P0-7 — Runtime minimal

Actions :

* ne pas servir un clone Git complet ;
* artefact standalone seulement ;
* `.env`, `.git`, docs, scripts hors runtime exposé ;
* vhost Nginx versionné ;
* rollback documenté.

---

# 20. Plan P1 — bêta élargie

## P1-1 — Canonicaliser les sessions

Décision :

> `SessionBooking` devient la source de vérité.

Actions :

* migrer usages `Session` legacy ;
* relier crédits, rapports, notifications ;
* tester réservation → crédit → rapport → bilan.

## P1-2 — Canonicaliser les bilans

Décision :

> `Bilan` devient la source canonique.

Actions :

* `Diagnostic`, `Assessment`, `StageBilan` deviennent sources legacy ;
* UI parent/élève lit `Bilan` ;
* publication unique ;
* PDF unique ;
* permissions uniques.

## P1-3 — CRM admissions

Actions :

* enrichir `ContactLead`;
* pipeline admissions ;
* assignation assistante ;
* relances ;
* tags campagne ;
* WhatsApp status ;
* motif de perte ;
* export CSV.

## P1-4 — Analytics growth

Actions :

* GA/Meta Pixel seulement après consentement ;
* events :

  * view_offer ;
  * start_bilan ;
  * submit_bilan ;
  * whatsapp_click ;
  * stage_interest ;
  * candidat_libre_interest ;
  * lead_qualified ;
  * enrolled.

## P1-5 — UX dashboards

Actions :

* audit dashboard admin ;
* audit assistante ;
* audit parent ;
* audit élève ;
* audit coach ;
* responsive tablette ;
* empty states ;
* erreurs ;
* permissions visibles.

---

# 21. Plan P2 — industrialisation

| Chantier       | Objectif                                                              |
| -------------- | --------------------------------------------------------------------- |
| CSP stricte    | Supprimer progressivement `unsafe-inline` / `unsafe-eval`.            |
| Accessibilité  | Audit WCAG sur parcours clés.                                         |
| Observabilité  | Logs structurés, correlation IDs, redaction PII.                      |
| RAG ADR        | Choix définitif backend/vector dimension.                             |
| IA coût        | Budget par élève, quota, logs de coût.                                |
| Support        | Macros WhatsApp/email, statut demande, SLA.                           |
| SEO            | Pages candidat libre, bac français Tunis, maths première, grand oral. |
| Data warehouse | Leads, conversions, paiements, cohortes.                              |

---

# 22. Cahier des charges v1 — Go-live ready 100 %

## Épic 1 — Acquisition et conversion

**Objectif :** transformer les visiteurs en leads qualifiés.

Exigences :

* page accueil à jour ;
* page stages prérentrée août 2026 ;
* page candidat libre ;
* page offres avec pricing canonique ;
* formulaire bilan gratuit ;
* tracking UTM ;
* bouton WhatsApp prérempli ;
* consentement analytics ;
* CRM lead.

Critères :

* un lead contient source, intérêt, niveau, statut, urgence ;
* un parent peut demander un bilan en moins de 2 minutes ;
* un clic WhatsApp est traçable ;
* aucun prix obsolète affiché.

## Épic 2 — Admissions

**Objectif :** gérer le passage lead → bilan → inscription.

Exigences :

* statut lead ;
* assignation assistante ;
* notes internes ;
* relance ;
* recommandation ;
* offre proposée ;
* inscription stage ou annuelle ;
* génération devis/facture.

Critères :

* chaque lead a un owner ;
* chaque lead a un prochain statut ;
* aucun lead ne reste NEW plus de 24 h sans alerte.

## Épic 3 — Paiement et droits

**Objectif :** garantir que tout paiement ouvre le bon droit.

Exigences :

* facture ;
* ligne produit ;
* code produit ;
* bénéficiaire élève ;
* paiement validé ;
* entitlement activé ;
* reçu ;
* audit trail.

Critères :

* impossible de payer un produit sans `productCode`;
* impossible d’activer un droit sans facture/payement validé ;
* replay webhook sans double activation ;
* mauvais montant refusé.

## Épic 4 — Sécurité API

**Objectif :** zéro exposition de données élèves/parents.

Exigences :

* auth guard ;
* role guard ;
* ownership ;
* Zod ;
* rate-limit ;
* projection explicite ;
* logs redacted ;
* tests IDOR.

Critères :

* chaque route dynamique sensible a un test négatif ;
* inventaire API final sans P0 réel ;
* security CI bloquante.

## Épic 5 — Dashboards

**Objectif :** chaque rôle voit uniquement ce qu’il doit voir.

Exigences :

* Admin : pilotage complet ;
* Assistante : admissions, élèves, coachs, factures, stages ;
* Coach : élèves assignés, séances, bilans ;
* Parent : enfants, bilans, factures, documents ;
* Élève : progression, ressources, sessions, bilans.

Critères :

* parent A ne voit jamais enfant B ;
* coach non assigné ne voit jamais élève ;
* élève ne voit jamais notes internes ;
* assistante ne voit pas secrets techniques.

## Épic 6 — IA / ARIA / RAG

**Objectif :** fournir une IA utile, contrôlée et gouvernée.

Exigences :

* backend RAG canonique ;
* sources traçables ;
* quota ;
* logs sans PII excessive ;
* mode bêta explicite ;
* fallback si IA down ;
* coût monitoré.

Critères :

* ARIA ne répond pas si entitlement absent ;
* conversation IDOR impossible ;
* health RAG disponible ;
* mode stub invisible au public.

## Épic 7 — Ops / Infra

**Objectif :** exploitation fiable.

Exigences :

* artefact minimal ;
* Nginx versionné ;
* SSL ;
* backup DB/documents ;
* restore drill ;
* monitoring ;
* rollback ;
* runbook incident.

Critères :

* restauration testée ;
* alerting opérationnel ;
* health complet ;
* release rollbackable en moins de 15 min.

---

# 23. Décision finale

## Statut actuel recommandé

> **Nexus Réussite est prêt pour une offensive marketing encadrée, mais pas encore pour un go-live applicatif large et autonome.**

## Ce qu’il faut faire maintenant

1. **Lancer la campagne prérentrée** vers `/bilan-gratuit` et WhatsApp.
2. **Garder la plateforme en bêta contrôlée** avec comptes connus.
3. **Finaliser P0/P1 sécurité, paiement, RGPD, monitoring, backup.**
4. **Industrialiser le CRM admissions.**
5. **Ne plus ajouter de nouvelles fonctionnalités tant que les doubles sources de vérité ne sont pas réduites.**

## La règle de décision

Le projet doit entrer dans une phase de **gel fonctionnel + consolidation**.

La prochaine étape ne doit pas être “ajouter encore une fonctionnalité”.
La prochaine étape doit être :

> **rendre fiable, traçable, testable et exploitable ce qui existe déjà.**

