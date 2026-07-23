
> Conserver l'image de rollback `nexus-app:backup-avant-nsi` jusqu'à validation complète de stabilité (minimum 24h).

## 12. Dette technique résiduelle
- Le `localStorage` côté client conserve un cache de secours ; le serveur reste la source de vérité.
- La gestion du mode offline partiel (retry, queue) n'est pas implémentée ; en cas d'erreur réseau, l'utilisateur doit rafraîchir.
- Les scripts temporaires de provisioning (`check-nsi-users.ts`, `prod-upsert-nsi-users.ts`) ont été déplacés hors workspace Git vers `/root/nexus-maintenance-scripts/` ; ils ne doivent pas être commités ni laissés dans `<APP_DIR>/scripts/` s'ils ne sont pas versionnés.

## 13. Plan nettoyage Docker
À exécuter uniquement après 24h de stabilité confirmée et avec accord explicite.

Inventaire préalable :
