# Fixture familiale du smoke vidéo désactivée

Date : 4 octobre 2026. Base : 9abd6fc66. Statut : NOT_READY.

## Cause

Sur 71a973349, Preview Video Disabled Build passe la construction standalone, les pages et leurs headers, puis échoue avec VIDEO_BROWSER_JOIN_HTTP_404. Sa fixture crée un utilisateur ELEVE sans profil Student ni lien au ParentProfile. Le guard familial refuse donc correctement avant de consulter la disponibilité vidéo. L'ancien parentId de réservation n'est plus une preuve suffisante d'ownership.

## Correction et vérifications

Le smoke crée maintenant le profil élève rattaché au parent synthétique canonique avant la réservation. Il vérifie l'existence du profil parent. Le nettoyage retire seulement les profils de ses utilisateurs synthétiques avant les utilisateurs, pour respecter le FK RESTRICT. Les assertions 503 VIDEO_DISABLED, absence de roomName, absence de mutation, de requête Jitsi, d'erreur console et d'auto-join sont conservées.

Un nouveau test rouge a reproduit l'absence de relation dans la fixture. Deux suites ciblées passent maintenant : 18 tests, dont les refus/pannes du guard vidéo. node --check et diff-check réussissent. Une première commande avait désigné un fichier de test inexistant ; cette erreur est corrigée et ne compte pas comme succès.

Aucun nouveau build/E2E standalone local exécuté : la CI sur le prochain SHA doit confirmer le parcours réel. Aucun changement d'autorisation produit, aucun accès ou déploiement de production, aucune migration.
