# Compatibilité avec l'architecture Nexus réelle

## Conclusion

**NO-GO en l'état.** Le lot compile mais n'est relié à aucune couche fonctionnelle. Le plan cible est compatible dans son intention avec Next.js/Prisma, mais pas encore avec les contraintes réelles de production, de jobs, de stockage et de convergence.

## Architecture observée

- Next.js 15 App Router, build standalone (`next.config.ts`), TypeScript strict et alias `@/*` (`tsconfig.json`).
- Auth NextAuth + middleware de redirection par rôle. Le matcher `middleware.ts` ne garde pas les API : chaque route doit appliquer son propre guard.
- Prisma/PostgreSQL central via `lib/prisma.ts`; nombreuses routes effectuent plusieurs écritures hors transaction.
- UI largement cliente sous `app/dashboard`; le rôle est aussi filtré par middleware serveur, mais il n'existe pas de rôle `ENSEIGNANT` ni `RESPONSABLE_PEDAGOGIQUE` dans le routage observé.
- RAG via client HTTP Chroma/FastAPI ; Ollama, Mistral, OpenAI/ARIA et Chutes sont présents selon les flux.
- Redis est une dépendance applicative, mais BullMQ est absent de `package.json`; le worker NPC est un autre workflow.

Commandes probantes : `sed/nl` sur `package.json`, `next.config.*`, `instrumentation.ts`, `middleware.ts`, `.github/workflows/*`, `docker-compose*.yml`, `prisma/schema.prisma`; `npm run typecheck`; `npm run build`.

## Matrice de compatibilité du module curriculum

| Besoin | État | Preuve | Risque |
|---|---|---|---|
| Interrogation serveur | techniquement importable | `lib/curriculum/index.ts:1-3` | pas marqué `server-only` |
| Diagnostics | absent | recherche `rg` sans import hors tests | programme non appliqué |
| Scoring | absent | aucune référence dans `lib/assessments`/`lib/diagnostics` | score non contextualisé |
| RAG | absent | `lib/rag-client.ts` ne connaît ni curriculumId/version | corpus non filtré |
| Mise à jour sans build | non | registre TypeScript `registry/math.ts` | recompilation/déploiement requis |
| Test hors réseau | oui | 15/15 tests curriculum | positif mais couverture incomplète |
| Stabilité anciens rapports | non démontrée | aucun snapshot curriculum stocké dans Assessment/Bilan | réinterprétation historique |

## Régressions architecturales recherchées

- **Imports serveur vers client** : aucune régression actuelle car module orphelin ; risque futur du barrel non protégé.
- **Bundle** : build réussi ; aucune preuve d'inclusion du registre. Le dashboard maths existant atteint 1,11 MB, indépendamment du changeset.
- **Alias scripts** : `tsconfig` exclut `scripts`; le registre n'est pas consommé par scripts. Risque non activé.
- **Guards API** : défauts actifs documentés dans `FRONTEND_BACKEND_ROUTING_AUDIT.md`.
- **Schéma/migrations** : `prisma validate` et `generate` passent, mais les tests DB restent bloqués ; aucune mutation Prisma dans ce lot.
- **Configuration dupliquée** : dimensions RAG 768 dans `docs/RAG_ARCHITECTURE.md`/ADR contre `VECTOR_DIM=3072` dans `.env.example`; collections divergentes dans le code.

## Production observée le 2026-07-11

Commande SSH en lecture seule sur l'hôte documenté `<PROD_HOST>` : PM2 indique `<PROCESS_NAME>|online`, script `.next/standalone/server.js`, cwd `<APP_DIR>`, un processus, 102 redémarrages ; repo production `main` au commit `1b8219b1...`. Chroma 1.1.1, ingestor, Ollama 0.3.13 sont healthy et exposés seulement en loopback (`8000`, `18001`, `11434`). PostgreSQL Nexus est healthy sur loopback `5435`. La liste filtrée des clés PM2 ne montrait que `NEXTAUTH_URL`; les autres valeurs peuvent être chargées par fichiers et restent `UNKNOWN_PRODUCTION_FACT`.

Le chemin `private/generated-reports` et les alternatives inspectées n'existaient pas. La production tourne sous PM2, alors que `docker-compose.prod.yml` décrit aussi un conteneur Next : la documentation n'est pas une source unique de vérité. Aucun worker durable du nouveau rapport n'a été observé. Les sauvegardes, la persistance Redis pertinente pour Nexus, le stockage objet, les URL signées et la procédure de rollback de la future chaîne sont `UNKNOWN_PRODUCTION_FACT`.

## Conditions minimales de compatibilité

ADR de convergence, module curriculum serveur/versionné avec stockage auditable, snapshots immuables, guards centralisés, transaction/idempotency sur soumission, worker durable séparé, stockage objet privé, RAG filtré par version et runbook production réconcilié avec PM2/topologie réelle.
