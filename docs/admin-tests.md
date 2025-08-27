# Panneau de diagnostic – Admin/Tests

Ce panneau permet aux administrateurs de vérifier rapidement l’état du système et d’exécuter des tests ciblés.

1) Statut Système
- Base de données: indique la connectivité, le nombre d’utilisateurs et le temps de réponse.
- Services externes:
  - RAG Service (Ingestion/Recherche documents)
  - LLM Service (Génération IA)
  - PDF Service (Génération de PDF)
- Les indicateurs affichent OK ou KO avec la latence en millisecondes.
- Source API: GET /api/status

2) Email (SMTP)
- Affiche la présence des variables d’environnement SMTP (ex: SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, etc.).
- Actions disponibles:
  - Tester la configuration: POST /api/admin/test-email { "action": "test_config" }
  - Envoyer un email de test: POST /api/admin/test-email { "action": "send_test", "testEmail": "dest@example.com" }
- Message de retour affiché en bas de section.

3) Paiements (Konnect / Wise)
- Affiche l’état de configuration (Konnect: apiKey, walletId, publicKey, webhookSecret; Wise: apiKey, profileId) et un indicateur global "Tout configuré".
- Actions disponibles (Konnect):
  - Tester la connexion: POST /api/admin/test-payments { "action": "test_connection" }
  - Créer un paiement de test (montant en millimes): POST /api/admin/test-payments { "action": "create_test_payment", "amount": 450000 }
  - Vérifier le statut d’un paiement: POST /api/admin/test-payments { "action": "check_status", "paymentRef": "..." }
- Un message d’état est affiché sous les boutons.

Bonnes pratiques & Sécurité
- Ne pas exposer les secrets (API keys, mots de passe) dans l’interface.
- Préférer des environnements de test pour les appels réels (sandbox/preprod) et limiter l’usage en production.
- Les webhooks doivent être signés (KONNECT_WEBHOOK_SECRET) et vérifiés côté serveur.

Dépannage rapide
- Si la base de données est KO:
  - Vérifier la variable DATABASE_URL et la santé du service Postgres dans Docker/infra.
- Si un service externe est KO:
  - Vérifier l’URL (RAG_SERVICE_URL, LLM_SERVICE_URL, PDF_GENERATOR_SERVICE_URL) et ses logs. Tester l’endpoint /health directement.
- Si SMTP échoue:
  - Tester la connectivité réseau (port), revoir les identifiants, et vérifier l’adresse d’expéditeur SMTP_FROM.
- Si Konnect échoue:
  - Contrôler les variables KONNECT_API_KEY, KONNECT_WALLET_ID, NEXTAUTH_URL, et la documentation d’API (mode test/production).


