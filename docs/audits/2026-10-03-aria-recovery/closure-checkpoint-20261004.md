# Point de clôture technique — 4 octobre 2026

Statut : NOT_READY. PR #337 OPEN/DRAFT. Aucun merge ou déploiement.

## Source et comptages bornés

Clone unique : /home/alaeddine/Bureau/nexus-aria-go-live-recovery-20261003, branche codex/aria-go-live-recovery-20261003, origin GitHub vérifié. Main reste 5ffd4dd8e1fb91b0eea42398670a260402660699 ; distant publié 71a973349981bf691939ca0dcf1dc4a455624776.

Snapshot du code : 98ff57b24ea60abc60bc72759b90e2759c29dc61. Il comprend 145 commits depuis main et 502 fichiers de PR, dont 66 commits supplémentaires depuis l'état local aad516f5c (79 antérieurs conservés). Le dernier lot de six commits locaux non publiés touche 35 fichiers. Ces bornes ne sont pas le nombre de commits d'une ancienne campagne. Le présent rafraîchissement documentaire constitue un commit supplémentaire, à distinguer de ce snapshot ; les cartes JSON indiquent explicitement leur SHA source.

## Défaut → correction → preuve → commit

| Défaut | Correction | Preuve locale | Commit |
| --- | --- | --- | --- |
| Téléchargement élève et parent propriétaire exposant ADMIN_ONLY | Autorité commune avant métadonnées/stockage ; tombstone expurgé | 54 tests ciblés, huit PostgreSQL réel, typecheck/lint | 48f9d6755 |
| Digest de proof transporté vers HMAC de déduplication mail ; retry concurrent P2002 | resetId/invitationId persistants, upsert atomique, premier payload/Message-ID conservés | 19 unitaires, 29 Core PostgreSQL, scénario huit retries ; scan/typecheck/lint | 9abd6fc66 |
| Smoke vidéo 404 malgré disponibilité désactivée | Fixture Student rattachée au ParentProfile, nettoyage FK sûr | 18 tests ; E2E standalone distant encore requis | dc182fd1d |
| Flux SSE parsé mais requête Chromium annulée ; cleanup absent après erreur | Consommateur natif progressif acquitté, annulation jointe, terminal après EOF | 49 SSE canoniques, 72 adjacents, 100 flux Chromium et 100 WebKit sans annulation | 0d499dc99 |
| E019 ×20 non qualifié | Campagne complète préalable, vingt exécutions serialisées, rapport privé expurgé et validateur strict | 269 governance, 33 contrats bootstrap, trois tests exécutant l'entrypoint synthétique | 1848af0ca |
| Mauvaise interprétation CLI du fichier/projet et du titre E019 | Sélection --project=aria-mobile et motif non ancré, collecte réelle isolée de Jest | Quatre tests d'entrypoint, collecteur réel : vingt cas exacts, sans navigateur/DB | 98ff57b24 |

Les tests rouges, erreurs de fixture et tentatives abandonnées sont décrits dans chaque document de lot. Aucun seuil, contrôle d'ownership, timeout ou assertion d'échec de requête n'est abaissé. Les micro-bancs ne qualifient pas l'application authentifiée.

## Revue et gates

La carte des 502 fichiers du snapshot distingue dix domaines et 126 chemins à haut risque. C'est une aide de revue, pas une clearance de sécurité. Les huit migrations ajoutées par la PR restent empreintées ; aucune nouvelle migration dans ces six commits. La matrice conserve ses 31 capacités, toutes non qualifiées production, leurs owners, scénarios et refus.

Le workflow 37227208707 du distant, à son état terminal, présente 44 succès, sept échecs et un contrôle ignoré. Une nouvelle campagne du HEAD final doit renouveler toutes les preuves. CodeQL #101 et policy de dépendance ne sont pas clos. L'exception dev braces sans correctif amont reste à traiter selon la policy ; aucune exception ou empreinte modifiée pour masquer un échec.

Gates externes toujours ouvertes : preuve de rotation/révocation TLS historique ; politique de conservation validée ; backup chiffré réellement restauré avec RPO/RTO ; accès/runbook officiel et rollback de staging ; nouvelle revue humaine du SHA exact. Les demandes opérationnelles préparées restent dans external-gates-20261004.md. Aucun secret demandé dans le chat.

## Préservation et opérations matérielles

Aucun dépôt gelé ou preuve privée historique modifié pendant ce lot. Aucun verrou supprimé, installation partagée réutilisée, prix modifié, base/volume/release de production touché, message réel ou paiement exécuté. Les deux dernières instances PostgreSQL synthétiques, labellisées et en tmpfs, ont été arrêtées par leur harness. Aucun autre processus tué. Les nouveaux micro-bancs et logs sont ignorés, dans le clone ; les serveurs de diagnostic historiques restent distincts du code courant. L'échec de lancement Firefox lié au cache existant n'a pas donné lieu à suppression de verrou.

Les seuls écrivains source identifiés sont cette session ; ses sous-agents ont seulement relu les deltas. Les processus fixture et l'ancien standalone diagnostique écrivent dans des artefacts ignorés et ne sont pas des preuves du HEAD courant. Espace libre au dernier relevé : 41 152 327 680 octets ; campagnes lourdes privilégiées sur CI distante. Aucun nettoyage supplémentaire de cache ou de preuve effectué.

## Suite engagée

Publication normale après scan de la plage, puis qualification CI exacte, E019 ×20 et fermeture causale des éventuels nouveaux chemins CodeQL. Les travaux de qualification fonctionnelle et les gates opérationnelles continuent ; aucune mise en Ready ou production tant qu'elles ne sont pas prouvées.
