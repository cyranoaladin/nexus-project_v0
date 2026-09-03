# Planning Studio — preuves de release (3 septembre 2026)

Document de preuves, sans chemin ni identifiant d'infrastructure (le runbook opératoire reste privé).

## Identités

```text
PLANNING_BASE_SHA=0c7c894cb2c1a3dd1283f4f5bad25404e89a9a0b
PLANNING_FEATURE_SHA=9b00ff18b2ec60dab8b3a5a9caf4890f82d609e7
PLANNING_MANIFEST_SHA=110692b700a4df18a21951650f764141d2b456e4
BUILD_ID=n6HHtyZzrpbK2zgFPkXWD
BUILD_NODE_VERSION=v22.22.0        (poste de build ; champ NODE_VERSION du manifeste = version de Node ayant produit l'artefact)
RUNTIME_NODE_VERSION=v22.23.1      (runtime épinglé, copié de release en release, vérifié par le lanceur)
NODE_VERSION_COMPATIBLE=true       (même ligne 22.x ; le manifeste décrit le build, pas le runtime — identique aux releases précédentes)
MANIFEST_SEMANTICS=NODE_VERSION = process.version du build (scripts/release/verify-standalone-artifact.mjs) ; le runtime est une propriété de la release, non du manifeste
PLANNING_SCHEMA_VERSION=2
CANONICAL_REVISION=1               (INIT, empreinte 270ee1094652c3b6 = empreinte du planning livré)
```

## Migration

```text
MIGRATION=20260903190000_add_planning_studio (additive : 1 enum, 2 tables, 3 index, 3 clés étrangères)
MIGRATION_CHECKSUM=242abc57c97381f382fc8709d9c83fcba1c7d59a4410a0ae1d7399bff97d9831
MIGRATION_PASS=true   (base vierge CI, base jetable locale, clone peuplé de production avec rollback SQL puis ré-application, production)
BACKUP_BEFORE_MIGRATION=true (dump complet horodaté, empreinte conservée hors dépôt)
INIT_IDEMPOTENT=true  (deux exécutions consécutives : 1 document, 1 révision)
```

## Qualification (release précédente puis release persistance)

| Porte | Résultat |
|---|---|
| Matrice d'accès middleware (anonyme, PARENT, ELEVE, ADMIN, ASSISTANTE, COACH ; `/planning` + 5 assets ; retour `callbackUrl`) | 9/9 |
| État partagé, 409 sans perte, COACH lecture seule (UI + API forgée), historique/restauration, PARENT/anonyme API, autosave | 6/6 |
| Gate canonique (45 séances, 44 actives, 1 inactive, 0 conflit bloquant, JS ≡ JSON, schéma v2) | PASS |
| Synchronisation source → artefact (`planning:check`) | PASS |
| Tests de l'outil (moteur, migration v1→v2, exports, historique) | 31/31 |
| Unitaires serveur : validation, service (double mémoire), permissions, matrice de rôles des 4 routes | 55/55 |
| PostgreSQL réel : init concurrente, verrou optimiste, restauration, cascade | 4/4 |
| RBAC existant (non-régression après ajout des politiques) | 184/184 |
| Outil autonome (Playwright, `file://`) | 48/48 |
| Typecheck, lint (politique du dépôt), scan de divulgation d'infrastructure, scan d'identifiants versionnés | PASS |
| Artefact standalone (traces, audit, 580 fichiers statiques, 115 fichiers publics) | VALID |
| Canary sur port libre avec environnement de production (santé, accueil, offres, connexion, `/planning`, API) | PASS |
| Bascule : garde avant/après/après-reload, identités pointeur/alias/pm2/exécutable, santé, journal d'erreurs | PASS |

## Écart 44 / 45 séances

```text
SESSION_TOTAL=45
SESSION_ACTIVE=44
SESSION_INACTIVE=1
SESSION_DELTA=JUSTIFIED
```

La séance inactive est `WED-1645-3-ET` (Étude encadrée / devoirs, 3e, mercredi 16h45–18h45, groupe 3E-SCO, encadrant ETUDE, Salle 3 exceptionnelle, note : « activer uniquement si encadrement disponible »). Elle figure déjà dans le JSON v1 d'origine (45 séances dont 1 inactive) ; « 44 » comptait les cartes actives affichées. Aucune séance n'a été ajoutée ni supprimée.

## Rollback

Release précédente conservée et redémarrable par bascule atomique du pointeur canonique. La migration est additive : l'ancienne release ignore les nouvelles tables. Rollback logique de la migration documenté dans `docs/planning-studio/README.md`.
