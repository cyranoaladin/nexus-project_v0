# Incident de sécurité — identifiants et lien signé versionnés

## Date

13 août 2026 (Africa/Tunis).

## Contexte

Un mot de passe de seed connu et un jeton complet de consultation de bilan étaient présents dans l'arbre Git. Le mot de passe permettait l'authentification de comptes de test actifs en production, dont un compte assistante privilégié. Le jeton correspondait à un lien de production encore actif.

Ce document ne contient aucune valeur de mot de passe, de jeton, de hash ou de secret fournisseur.

## Problèmes observés

- 167 comptes de seed ou synthétiques avaient un mot de passe dérivé d'une valeur présente dans le dépôt : 1 ADMIN, 1 ASSISTANTE, 12 COACH, 101 ELEVE et 52 PARENT.
- Les comptes privilégiés ne disposaient pas de MFA et leurs sessions étaient encore valides avant confinement.
- Le lien signé exposé avait 15 accès journalisés. Une source Chrome non attribuée a aussi soumis le consentement parent–élève.
- Une session du compte ASSISTANTE compromis a rejeté puis régénéré un bilan, approuvé/publié sa génération suivante et créé deux nouveaux liens. Ces deux liens n'avaient aucun accès au moment de leur révocation.
- Cette publication non autorisée a fait passer l'agrégat des régénérations encore en revue de 13 à 12. L'attempt 13b n'a pas été touché.
- Nginx journalisait les chemins et referers complets des liens porteurs. Les journaux conservés contenaient 16 jetons complets ; les 5 correspondant à la base étaient tous révoqués lors du contrôle.
- Quatre secrets historiques archivés dans le dépôt ne correspondent plus aux valeurs du runtime de production. Le statut d'un ancien credential chez son fournisseur externe n'est pas vérifiable depuis le serveur.

## Décisions prises

- Révocation irréversible du lien exposé et des deux liens créés par la session compromise.
- Rotation des mots de passe des 167 comptes, avec une valeur aléatoire distincte par compte, et incrément atomique de `sessionVersion` pour invalider les sessions existantes.
- Aucun compte ni aucune donnée métier supprimés.
- Mise en place en production d'un format de log Nginx qui masque le segment porteur dans le chemin et le referer. Les anciens journaux sont conservés comme preuves d'incident.
- Remplacement des credentials de seed par une génération au runtime et refus fail-closed de tout seed hors base PostgreSQL locale explicitement jetable.
- Remplacement du jeton réel de test par un jeton synthétique généré au runtime.
- Renforcement de `check:no-hardcoded` pour bloquer les mots de passe, secrets de service et liens signés complets versionnés sans afficher leur valeur.

## Fichiers modifiés

- Seeds et scripts de profils/E2E : génération runtime, garde de cible, manifestes locaux mode `0600` lorsque les tests doivent consommer le credential.
- Tests d'authentification et Playwright : lecture des credentials runtime ou valeurs synthétiques générées.
- Documentation et archives suivies : valeurs sensibles remplacées par des marqueurs de révocation/redaction.
- Configuration Nginx : masquage des chemins et referers de consultation.
- Scanner de dépôt et tests de régression sécurité.

## Tests exécutés

- Tests unitaires ciblés des gardes de seed, du scanner et de la journalisation Nginx.
- `npm run check:no-hardcoded` et `npm run security:repo`.
- `npm run typecheck`, `npm run lint` et build Next.js standalone avec audit d'artefact.
- Scan TruffleHog des secrets vérifiés sur l'arbre courant.
- Contrôles production en lecture seule : révocations, versions de session, traces métier, santé HTTP/PM2/Nginx et absence de correspondance avec les candidats structurés du dépôt.

## Résultats

- Les comptes concernés ne correspondent plus aux mots de passe structurés présents dans l'arbre courant.
- Les trois liens explicitement concernés sont révoqués ; le lien initial répond `404` sur landing, document et PDF.
- Les nouveaux accès Nginx aux routes porteuses sont journalisés avec chemin et referer masqués.
- Aucun accès métier supplémentaire attribuable au compte ASSISTANTE compromis n'a été observé après invalidation de sa session.

## Risques restants

- Les anciennes valeurs restent récupérables dans l'historique Git tant qu'une réécriture coordonnée de l'historique n'est pas décidée. Leur rotation/révocation réduit le risque opérationnel, mais la purge historique est un chantier distinct.
- Le fournisseur de l'ancien credential SMTP doit confirmer sa révocation côté service.
- L'attribution humaine des accès au lien et de la session Chrome est impossible avec les traces actuelles ; aucune table de login par compte n'existe.
- Les deux préfixes porteurs ont leur error log Nginx désactivé localement, car son format intégré peut inclure la ligne de requête brute. Les autres routes conservent l'error log global.
- La publication non autorisée n'est pas annulée automatiquement : une décision métier explicite est requise avant toute restauration d'état.

## Rollback

- Code : revert de la PR de purge si un workflow jetable doit être réparé, sans réintroduire de credential connu.
- Nginx : sauvegarde pré-changement conservée sur le serveur. Un rollback ne doit pas réactiver la journalisation des jetons porteurs.
- Rotations et révocations : irréversibles par conception ; créer de nouveaux accès nominaux via le canal opérationnel sécurisé si nécessaire.
