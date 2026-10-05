# Nettoyage des fixtures Golden Family et audit immuable

2026-10-05. Base locale : `4c53ad2feaa6c15671606122da0ecd032d31a7a9`.

La campagne cross-browser du SHA publié c76d372eb a terminé avec 77 succès et 3 échecs. Le nettoyage rencontrait la FK Restrict de l’audit de cancellation ; il ne s’agit pas d’une preuve de course de logout. La nouvelle migration protège volontairement cet historique.

Deux tests unitaires ont reproduit le nettoyage incompatible avant correction, puis réussi. Le helper vérifie à chaque appel la base jetable autorisée. Une fixture sans audit est supprimée comme auparavant. Une fixture auditée conserve ses relations et son historique : les credentials sont révoqués transactionnellement, les versions de session avancent une seule fois. Un second nettoyage reste idempotent. Aucun trigger ni FK n’est contourné.

Le scénario E2E conserve ses assertions métier et d’autorisation ; son contrôle terminal vérifie désormais la révocation et la conservation de l’historique au lieu d’exiger une suppression contradictoire avec l’audit append-only.

Preuve isolée `1791159822` : 3 suites PostgreSQL / 24 tests verts et 1 suite réelle de teardown / 2 tests verts. Migration du schéma courant sur une base synthétique vide, restauration chiffrée synthétique et interruption/reprise DDL réussies. Instance tmpfs appartenant au rehearsal arrêtée après vérification de stabilité des sources. Ces preuves ne constituent pas une restauration de sauvegarde de production.

Typecheck renouvelé : succès. La qualification navigateur distante du nouveau SHA et les répétitions requises restent à exécuter. Aucune règle de rétention de production n’est déduite du traitement des fixtures jetables.
