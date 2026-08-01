# BACKLOG — Tests de positionnement & Bilans

Découpage en lots séquentiels. Un lot ne démarre pas tant que le précédent n'a pas passé
ses critères de sortie (spec 06 §6). Chaque ticket = une branche, une PR, un rapport factuel.

Estimations en jours-homme Codex, à titre indicatif.

---

## L0 — Cadrage et socle (0,5 j)

| # | Ticket | Sortie attendue |
|---|---|---|
| L0.1 | Committer `AGENTS.positionnement.md` et `docs/specs/positionnement/**` | fichiers en place, aucun code touché |
| L0.2 | Committer `docs/adr/ADR-0012-...` | ADR acceptée |
| L0.3 | Arbitrage des 6 hypothèses du README | décisions consignées dans l'ADR |

**Bloquant** : L0.3 doit être tranché par Nexus avant L1. Les fixtures dépendent des hypothèses 1 et 2.

---

## L1 — Moteur de scoring (2 j)

| # | Ticket | Sortie |
|---|---|---|
| L1.1 | `lib/positionnement/types.ts`, `constants.ts` | types stricts, aucune constante ailleurs |
| L1.2 | `lib/positionnement/scoring.ts` conforme spec 02 | fonction pure, sans I/O |
| L1.3 | `__tests__/bilans/compute-facts.test.ts` + cas dorés | 100 % branches |
| L1.4 | Tests de propriété (monotonie, bornes, déterminisme, ordre) | verts |
| L1.5 | Vérification statique « aucun import réseau » dans le job `security` | job étendu |

**Le lot L1 est entièrement testable hors base de données et hors réseau.** C'est le meilleur
point de départ : il valide l'algorithme avant tout investissement d'infrastructure.

---

## L2 — Banque d'items (3 j, dépend de la production éditoriale)

| # | Ticket | Sortie |
|---|---|---|
| L2.1 | `item.schema.json` + `scripts/positionnement/compile-bank.ts` | compilation échouant au premier item invalide |
| L2.2 | Validations V1→V12 (spec 03 §2) | chacune couverte par un test |
| L2.3 | Banque `seconde.maths.v1` complète (18–24 items) | validée, `DRAFT` |
| L2.4 | Banques `3e.maths`, `3e.francais` | validées |
| L2.5 | Banques Première (Maths, Français EAF) | validées |
| L2.6 | Banques Terminale (Maths, PC, SVT, Philosophie) | validées |
| L2.7 | Banque Terminale NSI | **différée**, dépend du recrutement NSI |

Codex produit l'outillage et les gabarits ; le contenu disciplinaire relève de la validation
pédagogique humaine. Ne pas générer d'items sans relecture par un enseignant de la discipline.

---

## L3 — Persistance et API (3 j)

| # | Ticket | Sortie |
|---|---|---|
| L3.1 | Fusion de `schema.positionnement.prisma` + migration additive | migration produite, **non appliquée en production** |
| L3.2 | Contrainte SQL `leadId XOR userId` | migration + test |
| L3.3 | Service `attempts` : création, jeton, seed, TTL | testé |
| L3.4 | `POST /attempts` avec anti-énumération et limitation de débit | tests spec 06 §2 verts |
| L3.5 | `GET /attempts/current` sans fuite de clés | test d'inspection récursive vert |
| L3.6 | `PUT /answers/:itemId` idempotent | testé |
| L3.7 | `POST /submit` idempotent, concurrence maîtrisée | testé |
| L3.8 | Routes staff + matrice RBAC exhaustive | table complète verte |

**Point de contrôle P0** : à la fin de L3, exécuter le test « zéro `User` créé » et le test
d'anti-énumération avant toute mise en préproduction.

---

## L4 — Restitution et bilans (2,5 j)

| # | Ticket | Sortie |
|---|---|---|
| L4.1 | `restitution.ts` : sélection déterministe des blocs par audience | testé |
| L4.2 | Catalogue de fragments versionné | pas de chaîne en dur dans le code |
| L4.3 | Bilan `ELEVE` + écran de restitution | aucun score brut dans le DOM |
| L4.4 | Bilan `PARENT` + lien signé + revue humaine | inaccessible sans revue |
| L4.5 | Bilan `NEXUS` + vue staff | complet |
| L4.6 | `lexique-interdit.test.ts` | vert sur les 3 audiences × 6 cas |
| L4.7 | Rendu PDF via la chaîne éditoriale existante | aucune seconde chaîne créée |

---

## L5 — Exploitation (1,5 j)

| # | Ticket | Sortie |
|---|---|---|
| L5.1 | Tâche de purge idempotente selon spec 07 §6 | testée |
| L5.2 | Export CSV agrégé anonymisé | testé |
| L5.3 | `rescore` administrateur avec archivage de l'ancien résultat | testé |
| L5.4 | Aide à la calibration de groupe (spec 05 §4) | testée |
| L5.5 | Suite Playwright `positionnement` intégrée à la CI | verte |

---

## Dépendances externes

| Dépendance | Bloque | État |
|---|---|---|
| Arbitrage des 6 hypothèses | L1 | **en attente Nexus** |
| CPS compilé accessible en import typé | L2.1 | à vérifier au démarrage |
| Validation pédagogique des items | L2.3→L2.6 | ressource humaine |
| Recrutement intervenant NSI | L2.7 | lié au conflit de blocs Fenêtre 2 |
| Modèle `Lead` existant et stable | L3.3 | à vérifier au démarrage |
| Chaîne éditoriale PDF unifiée | L4.7 | existante |

## Hors périmètre explicite

Paiement, réservation de place, intégration ClicToPay, consolidation des 73 branches non fusionnées,
correction du conflit de blocs Terminale. Ces sujets ne sont pas traités ici et ne doivent pas
être ouverts en cours de route.
