# Observation publique de production — lecture seule

2026-10-05. Ces observations ne prouvent pas le déploiement de la PR #337. SHA servi inconnu. Aucun login ni écriture de données effectué.

Les huit pages publiques prioritaires et /auth/signin ont répondu 200, sans changement de domaine. Les en-têtes HTML CSP, HSTS, nosniff et frame étaient présents. Temps observés sur une requête par page : 0,207 à 0,292 seconde ; ce n’est ni un budget validé ni un test de charge. /api/health a répondu 200. Le chemin supposé /api/health/ready a répondu 404 : il ne constitue pas une preuve de défaillance d’un endpoint documenté. Le dépôt expose un contrôle interne protégé à /api/internal/health ; sa configuration ne prouve pas l’état réel des workers ou du stockage.

La validation TLS du domaine et de la chaîne a réussi avec TLS 1.3. Certificat SHA-256 : c1abd210064a8612d05e808d75859c2911814f6a27f40bcc74641758511f68a9. Clé publique SHA-256 : 72c7fa32217afa661bccf5b282f9d509389b27f27fe062e866c35151f6790ee5. Expiration : 2026-12-04T17:30:58Z.

Ces empreintes publiques ne prouvent ni la révocation de l’ancienne clé compromise, ni sa disparition de tous les systèmes actifs. Ce gate reste ouvert. Aucun fichier de clé privée consulté ou copié. Aucun secret ni donnée client requis par ces observations.
