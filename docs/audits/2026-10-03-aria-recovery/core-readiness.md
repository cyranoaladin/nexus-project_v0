# Disponibilité Core indépendante du RAG

## Critères avant correction

Le profil canonique est déjà dérivé de `RAG_API_BASE_URL` dans le gate de manifeste et le runbook : absent/vide/whitespace = CORE_ONLY. Aucun second feature flag ne doit décider ce profil.

- Monitoring interne reste soumis à `admin.dashboard`, avant toute probe.
- RAG absent = NOT_APPLICABLE ; aucun appel externe et aucune disponibilité RAG revendiquée.
- RAG ciblé mais non configuré = signal dégradé explicite, sans bloquer la readiness Core.
- Base et autorité d'authentification obligatoires indisponibles = readiness Core 503, sans fallback V1.
- Erreurs de probes expurgées : codes constants, jamais le message sous-jacent de connexion.
- Configuration SMTP/NPC/RAG distinguée d'une probe réseau ; le gate RAG externe garde sa preuve de provenance et de disponibilité propre.
- Redis obligatoire doit avoir une vraie probe bornée, sans incrémenter un compteur métier ni envoyer de notification.

## Reproduction

`npx jest --config jest.config.js --runInBand --ci --runTestsByPath __tests__/api/internal-health.route.test.ts` : 6 échecs causaux et 1 réussite sur le runtime initial. Les trois variantes CORE_ONLY et le RAG partiellement configuré retournent 503 ; le détail DB brut n'est pas expurgé ; l'autorité Core n'est pas testée. Le refus d'accès avant probes passe déjà.

Cette correction ne constitue pas une preuve de disponibilité production, de stockage, de worker, d'alertes ou de restauration. Ces gates restent distinctes.

## Correction et preuves locales

Le profil est partagé par `lib/deployment/rag-profile.ts`, réexporté par le script de manifeste sans changement de contrat. Le healthcheck protégé expose la readiness Core séparément des diagnostics SMTP/NPC/RAG, qui restent explicitement de configuration. Les bases V1 et l'autorité Core choisie sont sondées ; une erreur ne donne que son code constant. Redis utilise PING avec les deadlines existantes, sans compteur. Le client partage désormais une connexion en cours entre probe et requête métier : une barrière reproduisait deux connexions avant correction. Le healthcheck public ne journalise plus de message DB sous-jacent.

Les tests de la route interne passent de 7 échecs causaux / 1 succès à 8 succès. Les tests de lifecycle Redis prouvent absence d'incrément métier, réponse PONG, timeout et partage de connexion. Les tests d'autorité prouvent V1_ONLY sans connexion Core et HYBRID/V2_ONLY sans fallback. Suite ciblée finale : 12 suites / 117 tests réussis, typecheck et lint réussis. Les seuils et règles existants sont conservés.

Vérification réelle séparée : Redis local isolé issu d'une image déjà épinglée par ID, deux probes simultanées, nombre de clés inchangé ; PostgreSQL 16 Core isolé avec identité validée, SELECT 1 exécuté. Premier essai refusé par le garde de fixture locale, car l'environnement du harness conteneur référençait un hostname Docker ; aucun accès à ce hostname n'a été effectué. Une fixture locale dédiée a ensuite passé le contrôle. Aucun transport provider, secret production ni accès production.

Le `200` interne signifie readiness Core ; le corps peut rester `degraded` pour une capacité externe non prête. `runtimeVerified: false` pour le RAG évite d'assimiler configuration et homologation réelle. Stockage, worker effectif, dispatch outbox, métriques/alertes et gates de déploiement restent à qualifier.
